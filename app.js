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

app.get('/admindashboard', (req, res) => {
  res.sendFile(path.join(__dirname, "Admin_Dashboard/dashboard.html"));
});

app.get('/facilities', (req, res) => {
  res.sendFile(path.join(__dirname, "Admin_Dashboard/facilitiesreview.html"));
})
app.post('/register', async (req, res) => {
    try {
      const { email, password, AdminName, InstituteName, domain } = req.body;
      const hashedPassword = passwordHash.generate(password);
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: 'Admin'
      });
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

      const adminQuery = await admin.firestore().collection('admins').where('email', '==', email).get();
      if (adminQuery.empty) {
        res.status(401).send('Unauthorized');
        return;
      }
  
      const adminData = adminQuery.docs[0].data();
  
      if (passwordHash.verify(password, adminData.password)) {
        res.redirect('/admindashboard');
      } else {
        res.status(401).send('Unauthorized');
      }
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).send('Login failed');
    }
});  

app.post('/submit-review', async (req, res) => {
  try {
      const reviewData = req.body;

      // Assuming you have Firebase Firestore initialized
      const collegeName = reviewData.collegeName; // Get the college name from the form data

      // Create a reference to the "colleges" collection and a subcollection based on the college name
      const collegeRef = admin.firestore().collection('colleges').doc(collegeName).collection('reviews');

      // Store the review data in the subcollection
      await collegeRef.add(reviewData);
      console.log('Review data stored successfully under college:', collegeName);
      res.status(201).json({ message: 'Review submitted successfully' });
  } catch (error) {
      console.error('Error submitting review:', error);
      res.status(500).send('Error submitting review');
  }
});

app.get('/view-college/:collegeName', async (req, res) => {
  try {
      const collegeName = req.params.collegeName;

      // Create a reference to the subcollection for the specific college
      const collegeRef = admin.firestore().collection('colleges').doc(collegeName).collection('reviews');

      const reviews = [];
      const querySnapshot = await collegeRef.get();
      querySnapshot.forEach((doc) => {
          reviews.push(doc.data());
      });

      // Render or send this data as needed for display.
      // You can use a templating engine to create a beautiful display.

      res.json(reviews);
  } catch (error) {
      console.error('Error retrieving college data:', error);
      res.status(500).send('Error retrieving college data');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
