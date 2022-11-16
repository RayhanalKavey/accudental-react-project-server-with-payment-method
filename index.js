const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("colors");

const app = express();
const port = process.env.PORT || 5005;

// middle ware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("data is coming");
});
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
