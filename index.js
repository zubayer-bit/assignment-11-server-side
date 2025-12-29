//dotenv theke secret key gulu jeno github aa na jai ar jonno:
//"dotenv"-------(add kora holo "dotenv js" theke)
require("dotenv").config(); //then ".env" file make korbo

const express = require("express");
// --------(cors add kora holo)
const cors = require("cors");

//----jwt:1
const jwt = require("jsonwebtoken");

const app = express();

//1:-----(mongodb)-----mongodb connection:
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//"process.env.PORT ||" add kora holo
const port = process.env.PORT || 3000;

//middlewire add kora holo:
app.use(express.json());
app.use(cors());

//---------------------jwt:3
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  //token pacci kina check:
  // console.log('jwt token', req.headers);

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  //jodi token oo na thake:
  if (!token) {
    res.status(401).send({ message: "unauthorize access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden" });
    }

    //decode ar value check:
    // console.log("decoded value:", decoded);
    req.user = decoded; //jwt token ar decod data
    next();
  });
};

//2:-----(mongodb)-------mongodb "uri":
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bvxkl1z.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//3:------(mongodb)---------mongodb function-------(start)

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //----------(client and server ar code)----------(start)
    //"db","collection" create, get,post,delect,patch,put ar kaj ai khane:
    const db = client.db("asset_verse_user");
    //1:-----(payment hoa gele user data store)...kon "user" payment korlo,sei user ar  data store korar collection:
    const userCollection = db.collection("users");
    const assetCollection = db.collection("assets");
    const requestsCollection = db.collection("requests");
    const assignedAssetsCollection = db.collection("assignedAssets");
    const employeeAffiliationsCollection = db.collection(
      "employeeAffiliations"
    );

    //-------(user nije admin kina,seta check korar middle wire)---(start)
    //ai middle wire je khane use korbo,sekhane ata "verifyjwtToken" ar pore use korbo,
    const verifyHr = async (req, res, next) => {
      //user ar decoded email from verifyjwtToken:
      const email = req.user.email;
      const query = { email };

      //jara login korece,tader info ai "userCollection" ar moddhe ace
      const user = await userCollection.findOne(query);

      //akhn condition set korbo:
      if (!user || user.role !== "hr") {
        //ai "403" status send korle,client side aa "logout" kore dibe auto
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //-------(user nije admin kina,seta check korar middle wire)---(end)

    //-------------(employee ar jonno "verifyEmployee" make kora holo)-----(start)
    const verifyEmployee = async (req, res, next) => {
      //user ar decoded email from verifyjwtToken:
      const email = req.user.email;
      const query = { email };

      //jara login korece,tader info ai "userCollection" ar moddhe ace
      const user = await userCollection.findOne(query);

      //akhn condition set korbo:
      if (!user || user.role !== "employee") {
        //ai "403" status send korle,client side aa "logout" kore dibe auto
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //-------------(employee ar jonno "verifyEmployee" make kora holo)-----(end)

    //----------jwt:2
    //-----jwt:3 terminal aa --> node-->  require('crypto').randomBytes(64).toString('hex')  -->ata use korle hex key chole asbe
    app.post("/jwt", async (req, res) => {
      const user = req.body; // { email pabo,karon client side theke email send kora hoa ce just }

      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1d" });

      res.send({ token });
    });

    //"hr"  ar data "userCollection" aa post--(registration)---(start)
    app.post("/users", async (req, res) => {
      // client side ar data receive:
      const user = req.body;
      //"user"--> ar moddhe server-side theke  key and value add kora holo:
      user.role = "hr";
      user.packageLimit = 5;
      user.currentEmployees = 0;
      user.subscription = "basic";
      user.createdAt = new Date();

      //update date ar value "Profile update" page theke asbe...initially "null" thakbe:
      user.updatedAt = null;

      //insert houar agei check korbo,je same user ase kina,email dea:
      const email = user.email;
      const userExist = await userCollection.findOne({ email });
      if (userExist) {
        return res.send({ message: "user exits" });
      }
      //insert:
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //"hr"  ar data "userCollection" aa post-----(end)

    //assectCollection aa hr ar data post----------(start)
    app.post("/assets", verifyToken, verifyHr, async (req, res) => {
      const asset = req.body;

      //  JWT token ar email
      const tokenEmail = req.user.email;

      //  Client side ar email
      const clientEmail = asset.hrEmail;

      // Match check
      if (tokenEmail !== clientEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      //  decoded email from token
      const hrEmail = req.user.email;
      const productQuantity = Number(asset.productQuantity);

      const newAsset = {
        ...asset,
        productQuantity,
        availableQuantity: productQuantity, // calculate hobe pore
        hrEmail,
        dateAdded: new Date(),
        updatedAt: null,
      };

      const result = await assetCollection.insertOne(newAsset);
      res.send(result);
    });
    //assectCollection aa hr ar data post----------(end)

    //requests asset page aa "request button" ar status ki hobe,tar jonno"resuestsCollection" theke data get korbo-----tikh korte hbe---(start)
    app.get(
      "/requests-status",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        const { email } = req.query;

        const query = { requesterEmail: email };
        const requests = await requestsCollection.find(query).toArray();
        res.send(requests);
      }
    );
    //requests asset page aa "request button" ar status ki hobe,tar jonno "resuestsCollection" theke data get korbo--------(end)

    // HR only: get own asset requests-----(start)
    app.get("/hr/asset-requests", verifyToken, verifyHr, async (req, res) => {
      const hrEmail = req.user.email; // JWT theke email neya hocche

      const query = { hrEmail };
      const requests = await requestsCollection
        .find(query)
        .sort({ requestDate: -1 })
        .toArray();

      res.send(requests);
    });
    // HR only: get own asset requests-----(end)

    //hr jokhon request approved korbe tar code----(start)
    app.patch(
      "/asset-requests/approve/:id",
      verifyToken,
      verifyHr,
      async (req, res) => {
        const requestId = req.params.id;
        //jwt token theke email:
        const hrrEmail = req.user.email;

        try {
          //1:-----------
          //akhn Update userCollection currentEmployees for HR
          //but age check korbo je currentEmployees packageLimit er beshi na hoi jai:
          const hr = await userCollection.findOne({ email: hrrEmail });
          if (!hr) {
            return res.status(404).send({ message: "HR not found" });
          }
          if (hr.currentEmployees >= hr.packageLimit) {
            return res.status(403).send({
              message: "Employee limit reached. Please upgrade your package.",
            });
          }
          if (hr.currentEmployees < hr.packageLimit) {
            const updateUserPakageRelatedInfo = {
              $set: {
                currentEmployees: hr.currentEmployees + 1,
                updatedAt: new Date(),
              },
            };
            const updateResult = await userCollection.updateOne(
              { email: hrrEmail },
              updateUserPakageRelatedInfo
            );
          }

          //2:----------requestCollection ar data update korbo:
          const request = await requestsCollection.findOne({
            _id: new ObjectId(requestId),
          });

          if (!request)
            return res.status(404).send({ message: "Request not found" });

          if (request.requestStatus !== "pending") {
            return res
              .status(400)
              .send({ message: "Request already processed" });
          }

          if (request.hrEmail !== hrrEmail) {
            return res.status(403).send({ message: "Forbidden access" });
          }

          //akhn requestCollection ar data udate korbo,je data gulu update korbo ta destructuring kore nibo:
          // const {assetId, assetName, assetType,requesterName, requesterEmail, hrEmail, companyName, note, approvalDate, requestStatus, requestDate, processedBy } = request;

          //akhn update korbo requestCollection ar data:
          const updateDoc = {
            $set: {
              requestStatus: "approved",
              approvalDate: new Date(),
              processedBy: hrrEmail,
            },
          };
          //requestCollection aa "companyLogo" nai,tai "userCollection" theke nite hobe:
          const hrUser = await userCollection.findOne({ email: hrrEmail });
          if (!hrUser) {
            return res.status(404).send({ message: "HR user not found" });
          }
          //company logo ta nibo:
          const companyLogo = hrUser.companyLogo || null;

          // amra jeno right data update korte pari tar jonno "id" dea dite hobe
          const result = await requestsCollection.updateOne(
            { _id: new ObjectId(requestId) },
            updateDoc
          );

          //3;-------------
          //akhn employeeAffiliationsCollection aa data inserrt korbo:
          //check korbo employee affiliated agei ace kina:
          const affiliation = await employeeAffiliationsCollection.findOne({
            employeeEmail: request.requesterEmail,
            hrEmail: request.hrEmail,
          });
          if (!affiliation) {
            const affiliationData = {
              employeeName: request.requesterName,
              employeeEmail: request.requesterEmail,
              hrEmail: request.hrEmail,
              companyName: request.companyName,
              companyLogo: companyLogo,
              affiliationDate: new Date(),
              status: "active",
            };

            await employeeAffiliationsCollection.insertOne(affiliationData);
          }


          //4:------assignedAssetsCollection aa data insert korbo:
          //but tar age assets collection theke  id(request ar moddhe ace) dea  asset image ta nite hobe
          const asset = await assetCollection.findOne({
            _id: new ObjectId(request.assetId),
          });
          if (!asset) {
            return res.status(404).send({ message: "Asset not found" });
          }
          const assignedAssetData = {
            assetId: request.assetId,
            assetName: request.assetName,
            assetImage: asset.image,
          }

          res.send({ result });
        } catch (err) {
          console.error(err);
          res.status(500).send({ success: false, message: "Server error" });
        }
      }
    );
    //hr jokhon request approved korbe tar code----(end)

    //requestsCollection aa employee ar data post----------(start)
    app.post(
      "/asset-requests",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        const request = req.body;
        //  JWT token ar email
        const tokenEmail = req.user.email;
        //  Client side ar email
        const clientEmail = request.requesterEmail;
        // Match check
        if (tokenEmail !== clientEmail) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const newRequest = {
          ...request,
          
          approvalDate: null, //pending thakle ata null thakbe..approve hole date set hobe

          requestStatus: "pending",
          requestDate: new Date(),
          processedBy: null,
        };
        const result = await requestsCollection.insertOne(newRequest);
        res.send(result);
      }
    );
    //requestsCollection aa employee ar data post----------(end)

    //"employee"  ar data "userCollection" aa post--(registration)---(start)
    app.post("/users/employee", async (req, res) => {
      const user = req.body;

      user.role = "employee";
      // user.companyId = null;       // later via request
      // user.status = "unassigned";  // optional
      user.createdAt = new Date();
      user.updatedAt = null;

      const exists = await userCollection.findOne({ email: user.email });
      if (exists) return res.send({ message: "user exists" });

      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    //"employee"  ar data "userCollection" aa post-----(end)

    //hr asset edit korbe ar code---------(start)
    app.patch("/data/:id", verifyToken, verifyHr, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      // HR email check
      if (req.user.email !== updatedData.hrEmail) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...updatedData,
          updatedAt: new Date(),
        },
      };
      const result = await assetCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //hr asset edit korbe ar code---------(end)

    //hr asset delete korbe tar code---------(start)
    app.delete("/asset/:id", verifyToken, verifyHr, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });
    //hr asset delete korbe tar code---------(end)

    //edit asset ar jonno data get---------(start)

    app.get("/assets/:id", verifyToken, verifyHr, async (req, res) => {
      const { id } = req.params;

      const asset = await assetCollection.findOne({
        _id: new ObjectId(id),
      });

      // asset exists check
      if (!asset) {
        return res.status(404).send({ message: "Asset not found" });
      }

      // HR ownership check
      if (asset.hrEmail !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      res.send(asset);
    });

    //edit asset ar jonno data get---------(end)

    //employee ar request asset ar jonno data get "assectCollection" theke-------(start)
    app.get("/asset/available", async (req, res) => {
      //$gt = greater than
      // { $gt: 0 } mane 0 theke boro amn data gulu get hobe

      const query = { availableQuantity: { $gt: 0 } };
      const assets = await assetCollection.find(query).toArray();
      res.send(assets);
    });
    //employee ar request asset ar jonno data get "assectCollection" theke-------(end)

    //Asset list ar data paoar  jonno-------(start)
    //  app.get("/assets",verifyToken,async(req,res)=>{
    //   //client side theke email pabo:
    //   const {email} = req.query;

    //    //search input ar moddhe je text write korbo,seta akhane asbe:
    //       const searchText = req.query.searchText;

    //       //--------------------------
    //   //verify:
    //   //  JWT token ar email
    //   const tokenEmail = req.user.email;

    //   //  Client side ar email
    //   const clientEmail = email;

    //   // Match check
    //   if (tokenEmail !== clientEmail) {
    //     return res.status(403).send({ message: "Forbidden access" });
    //   }
    //   //-----------------------------

    //   //query:
    //   let query = {};

    //   //ai email ar user userCollection aa ace kina check korbo:
    //   const user = await userCollection.findOne({email});
    //   if(!user){
    //     return res.status(404).send({message:"User not found"});
    //   }

    //     //------------------------------------------(search text)
    //   //searchtext thakle query set korbo:
    //    if (searchText) {
    //         // partial vabe set korbo,jeno full text write korar agei value match kore fele:ai code "(mongodb.docs-->(https://www.mongodb.com/docs/manual/reference/operator/query/regex/))" ar moddhe pabo

    //         //$or--->ata use kore amra onk gulu key(email,displayName) dea data search korte parbo
    //         query.$or = [
    //           { companyName: { $regex: searchText, $options: "i" } },
    //           { productName: { $regex: searchText, $options: "i" } },
    //         ];
    //       }
    // //---------------------------------------(search text)

    //   //abr check korbo tar "role" "hr" kina:
    //   if(user.role === "hr"){
    //     //jodi "hr" hoi tahole shei "hr" ar sob asset dekhte parbe:
    //     //userCollection ar moddhe onk company ar "hr" thakte pare, tai shei "hr" ar email ar asset gulu dekhabe:
    //     query.hrEmail = email;
    //     const options = { sort: { dateAdded: -1 } };
    //     const result = await assetCollection.find(query, options).limit(10).toArray();
    //     return  res.send(result);
    //   }

    //  })

    //new vabe:
    app.get("/assets", verifyToken, verifyHr, async (req, res) => {
      const { email, searchText } = req.query;

      const tokenEmail = req.user.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const user = await userCollection.findOne({ email });
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      let query = {};

      if (searchText) {
        query.$or = [
          { companyName: { $regex: searchText, $options: "i" } },
          { productName: { $regex: searchText, $options: "i" } },
        ];
      }

      if (user.role === "hr") {
        query.hrEmail = email;

        const result = await assetCollection
          .find(query)
          .sort({ dateAdded: -1 })
          .limit(10)
          .toArray();

        return res.send(result);
      }

      return res.status(403).send({ message: "Access denied" });
    });

    //Asset list ar data paoar  jonno-------(end)

    //useRole------ar role ar data paoar jonno------(start)
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      //response ar moddhe ame "role" send korlam,rr jodi user na thake,tahole role by default hobe--> user
      res.send({ role: user?.role || "employee" });
    });
    //useRole------ar role ar data paoar jonno------(end)

    //----------(client and server ar code)----------(end)

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//3:------(mongodb)---------mongodb function---------(end)

app.get("/", (req, res) => {
  res.send("assignment 11 running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
