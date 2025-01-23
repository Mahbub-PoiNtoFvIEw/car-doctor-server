const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middle ware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://car-doctor-375d2.web.app',
    'https://car-doctor-375d2.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

console.log("pass", process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.galzq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware
const logger = (req, res, next)=>{
  console.log('log: info',req.method, req.url);
  next();
}

const verifyToken = (req, res, next)=>{
  const token = req.cookies?.token;
  // console.log('token in the middle ware',token);
  if(!token){
    return res.status(401).send({message: 'unauthorized access'});
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({message: 'unauthorized access'});
    }
    req.user = decoded;
    next();
  })
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const servicesCollection = client.db("carDoctor").collection("services");
    const productsCollection = client.db("carDoctor").collection("products");
    const bookingCollection = client.db('carDoctor').collection('bookings');

    // auth related api
    app.post('/jwt', logger, async(req, res)=>{
      const user = req.body;
      console.log('user for token',user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res
      .cookie('token', token,cookieOptions)
      .send({success: true});
    })

    // if user logout, clear the cookie
    app.post('/logout', async(req, res)=>{
      const user = req.body;
      console.log('logout user', user);
      res
      .clearCookie('token', { maxAge: 0})
      .send({success: true})
    })


    // services related api
    app.get("/services", async (req, res) => {
      const cursor = servicesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        // get only these three data
        projection: {title: 1, price: 1, service_id: 1, img: 1}
      }
      const result = await servicesCollection.findOne(query, options);
      res.send(result);
    });


    // bookings
    app.get('/bookings', logger, verifyToken, async(req, res)=>{
      console.log(req.query.email)
      console.log('token owner info', req.user)
      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      let query ={};
      if(req.query?.email){
        query = { email: req.query.email}
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/bookings', async(req, res)=>{
        const booking = req.body;
        console.log(booking)
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
    })

    app.patch('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const updateBooking = req.body;
      console.log(updateBooking);
      const updateDoc = {
        $set:{
          status: updateBooking.status
        }
      }
      const result = await bookingCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    app.delete('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const query =  {_id: new ObjectId(id)};
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("car doctor is running");
});

app.listen(port, () => {
  console.log(`car doctor server is running on port : ${port}`);
});
