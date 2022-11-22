const { MongoClient, ServerApiVersion, ObjectId, Admin } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { query } = require("express");
const { strip } = require("colors");

require("dotenv").config();
require("colors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5005;

// middle ware
app.use(cors());
app.use(express.json());

//===========connections

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hufticd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//JWT verify function workinG
function verifyJWT(req, res, next) {
  // console.log("Token find in server", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("Unauthorized access.");
  }
  const token = authHeader.split(" ")[1];

  //verify
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access." });
    }
    req.decoded = decoded;
    next();
  });
}
/*

*API naming convention
*app.get('/bookings')
*app.get('/bookings/:id')
*app.post('/bookings')
*app.patch('/bookings/:id')
*app.delete('/bookings/:id')
******

*/
// client.connect((err) => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });
async function run() {
  try {
    //-----------=============================
    // collection --1 appointmentOptions
    const appointmentOptionCollection = client
      .db("accuDental")
      .collection("appointmentOptions");
    // collection --2 bookings
    const bookingsCollection = client.db("accuDental").collection("bookings");
    // collection --3 user
    const usersCollection = client.db("accuDental").collection("users");
    // collection --4 doctors
    const doctorsCollection = client.db("accuDental").collection("doctors");
    // collection --5 payments
    const paymentsCollection = client.db("accuDental").collection("payments");
    //-----------=============================

    //verify admin///notE: Make sure you run verify admin after verifyAdmin workinG
    const verifyAdmin = async (req, res, next) => {
      // console.log("inside verify admin", req.decoded);
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        //kmne 1st admin?
        return req.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    //-----------=============================
    // Read data --1
    // to do :Use aggregate to query multiple collection and then merge data
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;

      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();

      //get the bookings of the provided date
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();
      // console.log(alreadyBooked); Code carefully
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        // console.log(optionBooked); //reload appointment page page
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option?.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
        // console.log(option.name, remainingSlots.length); //reload appointment page page
      });
      res.send(options);
    });
    //--1 for selecting specialty get some specific data from the api where id will be included by default but it also can be ignored.// test http://localhost:5005/appointmentSpecialty
    app.get(`/appointmentSpecialty`, async (req, res) => {
      const query = {};
      const options = await appointmentOptionCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(options);
    });

    //-----------=============================
    //read data --2
    app.get(`/bookings`, verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send("Forbidden Access");
      }
      const query = { email: email };
      const options = await bookingsCollection.find(query).toArray();
      res.send(options);
    });
    //Post data --2
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      // console.log(booking);
      const query = {
        appointmentDate: booking.appointmentDate,
        treatment: booking.treatment,
        email: booking.email,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already hvae a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });
    ///get api for booking with a specific id --2
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    });

    //-----------=============================
    //get Data --3
    app.get(`/users`, async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    //Post data --3
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      // console.log(result);
      res.send(result);
    });

    //get admin --3 fetch this is admin data using custom hook in the client site
    app.get(`/users/admin/:email`, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      // console.log("hello", user);
      res.send({ isAdmin: user?.role === "admin" });
      // console.log(user.role);
      // console.log({ isAdmin: user?.role === "admin" });
    });
    //update data for making admin --3     Q?
    app.put("/users/admin/:id", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        //kmne 1st admin?
        return req.status(403).send({ message: "Forbidden access" });
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = { $set: { role: "admin" } };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    //-----------=============================
    //jwt check: http://localhost:5005/jwt?email=tt@tt.com
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.find(query).toArray();
      // console.log(user);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });
    //-----------=============================
    //--4 get doctors data //workinG
    app.get(`/doctors`, verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const doctor = await doctorsCollection.find(query).toArray();
      res.send(doctor);
    });
    //--4 post doctor collection
    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });
    //--4 deleting doctors
    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(query);
      res.send(result);
    });
    //-----------=============================
    //Payment api
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //--5
    //-----------=============================
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updateResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    //Temporary to update price field on appointment collection (updatemany)--1
    // app.get("/addPrice", async (req, res) => {
    //   const filter = {};
    //   const updatedDoc = { $set: { price: 299 } };
    //   const options = { upsert: true };
    //   const result = await appointmentOptionCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });
  } finally {
  }
}
run().catch(console.dir);
//===========

app.get("/", (req, res) => {
  res.send("Welcome to AccDental server");
});
app.listen(port, () => {
  console.log(`AccDental server is running on port: ${port}`);
});
