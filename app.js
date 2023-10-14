const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
var passwordHash = require('password-hash');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const serviceAccount = require('./key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://console.firebase.google.com/u/0/project/college-critic/firestore/data/~2F"
});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/css', (req, res, next) => {
  res.type('text/css');
  next();
}, express.static(path.join(__dirname, './css')));

app.use('/js', (req, res, next) => {
    res.type('text/js');
    next();
  }, express.static(path.join(__dirname, './js')));

app.use('/public', express.static(path.join(__dirname, './public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
  console.log("started");
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "Admin_Register/index.html"));
});

app.get('/login', (req, res) =>{
    res.sendFile(path.join(__dirname, "Admin_Register/index.html"));
});

app.post('/register', async (req, res) => {
    try {
      const { email, password, AdminName, InstituteName, domain } = req.body;
      const hashedPassword = passwordHash.generate(password);
      // Create a new user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: 'Admin'
      });
      // Store admin details in Firestore
      const adminData = {
        email: email,
        AdminName: AdminName,
        InstituteName: InstituteName,
        domain: domain,
        password: hashedPassword
      };
  
      await admin.firestore().collection('admins').doc(userRecord.uid).set(adminData);
  
      console.log('Successfully created new user:', userRecord.uid);
      res.redirect('/login')
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).send('Error creating user');
    }
});

app.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Get the admin document from Firestore by email
      const adminQuery = await admin.firestore().collection('admins').where('email', '==', email).get();
      if (adminQuery.empty) {
        res.status(401).send('Unauthorized'); // Admin not found
        return;
      }
  
      const adminData = adminQuery.docs[0].data();
  
      // Verify the user's password
      if (passwordHash.verify(password, adminData.password)) {
        // Passwords match; proceed with login
        res.status(200).send('Login successful');
      } else {
        // Passwords do not match
        res.status(401).send('Unauthorized');
      }
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).send('Login failed');
    }
});  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
