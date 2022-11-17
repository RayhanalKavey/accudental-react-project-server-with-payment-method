const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("colors");

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
// client.connect((err) => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });
async function run() {
  try {
    // collection --1 appointmentOptions
    const appointmentOptionCollection = client
      .db("accuDental")
      .collection("appointmentOptions");
    // collection --2 bookings
    const bookingsCollection = client.db("accuDental").collection("bookings");

    // Read data --1
    app.get("/appointmentOptions", async (req, res) => {
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();
      res.send(options);
    });

    //read data --2
    app.get(`/bookings`, async (req, res) => {
      const query = {};
      const options = await bookingsCollection.find(query).toArray();
      res.send(options);
    });
    //Post data --2
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      // console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });
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
