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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Update this path to your views directory

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

app.get('/studentregister', (req, res) => {
  res.sendFile(path.join(__dirname, "student_register/index.html"));
});

app.get('/studentlogin', (req, res) => {
  res.sendFile(path.join(__dirname, "student_register/index.html"));
});

app.get('/admindashboard', (req, res) => {
  res.sendFile(path.join(__dirname, "Admin_Dashboard/dashboard.html"));
});

app.get('/facilities', (req, res) => {
  res.sendFile(path.join(__dirname, "Admin_Dashboard/facilitiesreview.html"));
});

app.get('/reviews', (req, res) => {
  res.sendFile(path.join(__dirname, "Admin_Dashboard/reviews.html"));
});

app.get('/studentreview', (req, res) => {
  res.render(__dirname + "/views/" + "index.ejs", { studentEmail : "", collegeName : "" })
});

app.get('/college-details', (req, res) => {
  res.render(__dirname + "/views/show.ejs", { collegeData : "", reviews : "" });
});

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

app.post('/studentregister', async (req, res) => {
  try {
    const { email, password, StudentName, InstituteName } = req.body;
    const hashedPassword = passwordHash.generate(password);
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: 'Student'
    });

    const studentUID = userRecord.uid;
    // Now, let's check if the provided email matches the domain of the InstituteName
    // First, retrieve the domain from the admin's data based on the InstituteName
    const adminQuery = await admin.firestore().collection('admins').where('InstituteName', '==', InstituteName).get();

    if (adminQuery.empty) {
      res.status(404).send('Institute not found');
      return;
    }

    // Assuming InstituteName is unique, so there should be only one result
    const adminData = adminQuery.docs[0].data();
    const instituteDomain = adminData.domain;

    // Check if the student's email matches the expected domain
    if (email.endsWith(`@${instituteDomain}`)) {
      // If it matches, proceed with storing the student data
      const studentData = {
        uid: studentUID,
        email: email,
        StudentName: StudentName,
        InstituteName: InstituteName,
        password: hashedPassword
      };

      const collegeName = adminData.InstituteName;
      const collegeStudentsRef = admin.firestore().collection('colleges').doc(collegeName).collection('students');
      await collegeStudentsRef.doc(userRecord.uid).set(studentData);
      console.log('Successfully created new student:', userRecord.uid);
      res.redirect('/studentlogin');
    } else {
      // If the email doesn't match, you can handle it appropriately.
      res.status(400).send('Student email domain does not match the expected domain for the institute.');
    }
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).send('Error creating student');
  }
});

app.post('/studentlogin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const studentEmail = email;
    const collegeName = req.body.InstituteName; // Get the InstituteName from the form data

    // Query the "students" collection under the specific college
    const studentQuery = await admin.firestore().collection('colleges').doc(collegeName).collection('students').where('email', '==', email).get();

    if (studentQuery.empty) {
      res.status(401).send('Unauthorized');
      return;
    }

    const studentData = studentQuery.docs[0].data();

    if (passwordHash.verify(password, studentData.password)) {
      // res.redirect(`/studentreview?email=${email}&collegeName=${collegeName}`);
      res.render("index.ejs", { studentEmail : studentEmail, collegeName : collegeName });
    } else {
      res.status(401).send('Unauthorized');
    }
  } catch (error) {
    console.error('Error during student login:', error);
    res.status(500).send('Login failed');
  }
});

app.post('/submit-facilities', async (req, res) => {
  try {
    const facilitiesData = req.body;

    const collegeName = facilitiesData.collegeName; // Get the college name from the form data

    // Create a reference to the "colleges" collection and a subcollection based on the college name
    const collegeRef = admin.firestore().collection('colleges').doc(collegeName).collection('facilities');

    // Store the review data in the subcollection and capture the auto-generated ID
    const facilitiesDocRef = await collegeRef.add(facilitiesData);
    const facilitiesDoc = {
      facilitiesDocId : facilitiesDocRef.id,
    }

    // Assuming "facilitiesDocId" is the field where you want to store the ID
    await facilitiesDocRef.set(facilitiesDoc, { merge : true });
    res.redirect(302, '/facilities');
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).send('Error submitting review');
  }
});

app.post('/studentreview', async (req, res) => {
  try {
    const { review, email, college } = req.body;

    // First, you need to get the InstituteName associated with the student's email
    const studentQuery = await admin.firestore().collection('colleges').doc(college).collection('students').where('email', '==', email).get();

    if (studentQuery.empty) {
      res.status(404).send('Student not found');
      return;
    }

    const studentData = studentQuery.docs[0].data();

    // Reference to the student's document in the "students" collection under the specific college
    const studentRef = admin.firestore().collection('colleges').doc(college).collection('students').doc(studentData.uid);

    const reviewData = {
      review: review,
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Optional: add a timestamp
    };

    // Set the review data in the student's document (merge: true ensures it updates existing data)
    await studentRef.set(reviewData, { merge: true });

    console.log('Review submitted successfully');
    res.redirect(302, '/studentreview');
  } catch (error) {
    console.error('Error submitting student review:', error);
    res.status(500).send('Error submitting review');
  }
});

app.post('/college-details', async (req, res) => {
  try {
    const collegeName = req.body.collegeName; // Get the college name from the request body

    // Query the "colleges" collection to get college details
    const collegeDoc = await admin.firestore().collection('colleges').doc(collegeName).get();

    // if (!collegeDoc.exists) {
    //   res.status(404).send('College not found');
    //   return;
    // }

    // Query the "facilities" subcollection to get facilities data for that college
    const facilitiesQuery = await collegeDoc.ref.collection('facilities').get();

    const facilities = [];

    facilitiesQuery.forEach((facilityDoc) => {
      // Add each facility document to the facilities array
      facilities.push(facilityDoc.data());
    });

    // Query the "colleges/collegeName/students" subcollection to get reviews
    const reviewsQuery = await admin.firestore().collection('colleges').doc(collegeName).collection('students').get();

    // Create an array to store reviews
    const reviews = [];
    reviewsQuery.forEach((doc) => {
      const reviewData = doc.data().review;
      const student = doc.data().StudentName;
      // Add review data to the reviews array
      reviews.push({ student, reviewData });
    });

    // Render the EJS template with college details and reviews data
    res.render('show.ejs', { collegeData : facilities, reviews : reviews });
  } catch (error) {
    console.error('Error getting college details:', error);
    res.status(500).send('Error getting college details');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
