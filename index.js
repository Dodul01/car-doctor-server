const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors({
  origin: [
    // 'http://localhost:5173',
    // 'https://mighty-representative.surge.sh',
    'https://car-doctor-auth-3841d.web.app',
    'https://car-doctor-auth-3841d.firebaseapp.com'
],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const logger = async (req, res, next) => {
  console.log('called: ', req.host, req.originalUrl);
  next()
}

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized' })
  }

  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded)=>{
    if(error){
      return res.status(401).send({message: 'unauthorized'});
    }
    req.user = decoded;
    next()
  })
}

const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db('carDoctorDB')
    const servicesCollection = database.collection('services');
    const ordersCollection = database.collection('orders');

    // AUTH JWT
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res
        // .cookie('token', token, {
        //   httpOnly: false,
        //   secure: true,
        //   sameSite: 'strict'
        // })
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
        .send({ success: true });
    })


    app.post('/logout', async (req, res)=>{
      const user = req.body;
      res.clearCookie('token', {maxAge: 0}).send({success: true});
    })

    // get all services
    app.get('/services', async (req, res) => {
      const cursor = servicesCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    // get single service
    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const service = await servicesCollection.findOne(query);
      res.send(service)
    })

    app.post('/orders', async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);

      res.send(result);
    })

    app.get('/orders', logger, verifyToken, async (req, res) => {
      // console.log(req.cookies.token);
      // console.log(req.user.email);
      if(req.query?.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }

      const cursor = ordersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Welcome to the car doctor server.')
})



app.listen(port, () => {
  console.log(`server is running on port ${port}`);
})