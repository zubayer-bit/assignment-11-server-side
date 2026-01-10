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

//---payment process: step:1
const stripe = require('stripe')(process.env.STRIPE_SECRET);


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
    const paymentCollection = db.collection("payment");
    const packagesCollection = db.collection("packages");   //ata kaj korbo akhn...
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

    //****************(home page)********(start)** */

    //1: packageCollection theke data get kore home ar package section aa set kora holo------(start)
    app.get("/packages/homePage",async(req,res)=>{
      const result = await packagesCollection.find({}).toArray();
      res.send(result);
    })
    //1: packageCollection theke data get kore home ar package section aa set kora holo------(start)
    //****************(home page)********(end)** */

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
        const hrEmail = req.user.email;

        try {
          /* ===============================
         1️: -----Find request & validation
      =============================== */
          const request = await requestsCollection.findOne({
            _id: new ObjectId(requestId),
          });

          if (!request) {
            return res.status(404).send({ message: "Request not found" });
          }

          if (request.requestStatus !== "pending") {
            return res
              .status(400)
              .send({ message: "Request already processed" });
          }

          if (request.hrEmail !== hrEmail) {
            return res.status(403).send({ message: "Forbidden access" });
          }

          /* ===============================
         2️: ------HR package limit check
      =============================== */
          const hr = await userCollection.findOne({ email: hrEmail });

          if (!hr) {
            return res.status(404).send({ message: "HR not found" });
          }

          if (hr.currentEmployees >= hr.packageLimit) {
            return res.status(403).send({
              message: "Employee limit reached. Please upgrade your package.",
            });
          }

          /* ===============================
         3️: -------Update request status
      =============================== */
          const updateRequestResult = await requestsCollection.updateOne(
            { _id: new ObjectId(requestId) },
            {
              $set: {
                requestStatus: "approved",
                approvalDate: new Date(),
                processedBy: hrEmail,
              },
            }
          );

          if (updateRequestResult.modifiedCount === 0) {
            return res
              .status(500)
              .send({ message: "Failed to update request" });
          }

          /* ===============================
         4️: ------Employee affiliation+ currentEmployees increase code (first time)
      =============================== */
          // let isNewEmployee = false;

          // const affiliationExists =
          //   await employeeAffiliationsCollection.findOne({
          //     employeeEmail: request.requesterEmail,
          //     hrEmail: request.hrEmail,
          //   });

          // if (!affiliationExists) {
          //   const hrUser = await userCollection.findOne({ email: hrEmail });

          //   const affiliationData = {
          //     employeeName: request.requesterName,
          //     employeeEmail: request.requesterEmail,
          //     hrEmail: request.hrEmail,
          //     companyName: request.companyName,
          //     companyLogo: hrUser?.companyLogo || null,
          //     affiliationDate: new Date(),
          //     status: "active",
          //   };

          //   const affiliationResult =
          //     await employeeAffiliationsCollection.insertOne(affiliationData);

          //   if (!affiliationResult.insertedId) {
          //     return res
          //       .status(500)
          //       .send({ message: "Failed to create affiliation" });
          //   }

          //   //true korlam,jodi notun employee hoi:
          //   isNewEmployee = true;
          // }

          // //currentEmployees increase korbo,jodi notun employee hoi:
          // if (isNewEmployee) {
          //   //----------------
          //   const hrUpdateResult = await userCollection.updateOne(
          //     { email: hrEmail },
          //     {
          //       // $inc mane existing value ar sathe add kore dibe
          //       $inc: { currentEmployees: 1 },
          //       $set: { updatedAt: new Date() },
          //     }
          //   );

          //   if (hrUpdateResult.modifiedCount === 0) {
          //     return res
          //       .status(500)
          //       .send({ message: "Failed to update HR employee count" });
          //   }
          // }

          //ai code ta new vabe kora holo...hr "remove" button click korle "employee"-->"affiliatedEmployee" list theke delete korte cina,just-->status: inactve korci....tai ai code ta update kore set korlam:

          /* ===============================
   4️:---- Employee affiliation + currentEmployees logic
================================ */

          let shouldIncreaseEmployeeCount = false;

          // find existing affiliation (active OR inactive)
          const affiliation = await employeeAffiliationsCollection.findOne({
            employeeEmail: request.requesterEmail,
            hrEmail: request.hrEmail,
          });

          //  1️: Completely new employee
          if (!affiliation) {
            const hrUser = await userCollection.findOne({ email: hrEmail });

            const affiliationData = {
              employeeName: request.requesterName,
              employeeEmail: request.requesterEmail,
              hrEmail: request.hrEmail,
              companyName: request.companyName,
              companyLogo: hrUser?.companyLogo || null,
              affiliationDate: new Date(),
              status: "active",
            };

            const affiliationResult =
              await employeeAffiliationsCollection.insertOne(affiliationData);

            if (!affiliationResult.insertedId) {
              return res
                .status(500)
                .send({ message: "Failed to create affiliation" });
            }

            shouldIncreaseEmployeeCount = true;
          }

          //  2️: Existing but inactive employee (re-join)
          else if (affiliation.status === "inactive") {
            const affiliationUpdateResult =
              await employeeAffiliationsCollection.updateOne(
                { _id: affiliation._id },
                {
                  $set: {
                    status: "active",
                    affiliationDate: new Date(),
                  },
                }
              );

            if (affiliationUpdateResult.modifiedCount === 0) {
              return res
                .status(500)
                .send({ message: "Failed to reactivate affiliation" });
            }

            shouldIncreaseEmployeeCount = true;
          }

          // 3️: Already active employee → do nothing

          // Increase HR employee count only when needed
          if (shouldIncreaseEmployeeCount) {
            const hrUpdateResult = await userCollection.updateOne(
              { email: hrEmail },
              {
                $inc: { currentEmployees: 1 },
                $set: { updatedAt: new Date() },
              }
            );

            if (hrUpdateResult.modifiedCount === 0) {
              return res
                .status(500)
                .send({ message: "Failed to update HR employee count" });
            }
          }

          /* ===============================
         5️: ------Find asset
      =============================== */
          const asset = await assetCollection.findOne({
            _id: new ObjectId(request.assetId),
          });

          if (!asset) {
            return res.status(404).send({ message: "Asset not found" });
          }

          if (asset.availableQuantity <= 0) {
            return res.status(400).send({ message: "Asset not available" });
          }

          /* ===============================
         6️:  Assign asset
      =============================== */
          const assignedAssetData = {
            assetId: request.assetId, //check korte hobe object hisebe store hocce kina

            assetName: request.assetName,
            assetImage: asset.productImage,
            assetType: request.assetType,
            employeeEmail: request.requesterEmail,
            employeeName: request.requesterName,
            hrEmail: request.hrEmail,
            companyName: request.companyName,
            assignmentDate: new Date(),
            returnDate: null, //return korle date add kore dite hbe
            status: "assigned", //return korle "returned" kore dite hbe
          };

          const assignedResult = await assignedAssetsCollection.insertOne(
            assignedAssetData
          );

          if (!assignedResult.insertedId) {
            return res.status(500).send({ message: "Failed to assign asset" });
          }

          /* ===============================
         7️:Update asset quantity
      =============================== */
          const assetUpdateResult = await assetCollection.updateOne(
            { _id: new ObjectId(request.assetId) }, //object hisebe id pass hocce kina ta check korte hobe
            {
              $inc: { availableQuantity: -1 },
              $set: { updatedAt: new Date() },
            }
          );

          if (assetUpdateResult.modifiedCount === 0) {
            return res
              .status(500)
              .send({ message: "Failed to update asset quantity" });
          }

          /* ===============================
         8:Success response sesss
      =============================== */
          res.send({
            success: true,
            result: updateRequestResult, // client-side check
            message: "Asset request approved successfully",
          });
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    //hr jokhon request approved korbe tar code----(end)

    //hr direct-assign-asset to "employee" (modal ar--> "Assign" button click korle ja hobe)--------(start)
    //     app.patch("/direct-assign/:id", verifyToken, verifyHr, async(req,res)=>{
    //       const assetId = req.params.id;  //assetId "string"
    //       const { employeeEmail, employeeName } = req.body;

    //       //hr email from jwt token:
    //       const hrEmaill = req.user.email;
    //       // check affiliation
    // const affiliation = await employeeAffiliationsCollection.findOne({
    //   employeeEmail,
    //   hrEmaill,
    //   status: "active",
    // });

    // if (!affiliation) {
    //   return res
    //     .status(403)
    //     .send({ message: "Employee is not affiliated with you" });
    // }

    //       //try-catch apply kore:
    //       try{

    //          /* ===============================
    //          5️: ------Find asset  (akhane asset ar id lagbe)
    //       =============================== */
    //           const asset = await assetCollection.findOne({
    //             _id: new ObjectId(assetId),  //akhan theke asset ar value peye jabo
    //           });

    //           if (!asset) {
    //             return res.status(404).send({ message: "Asset not found" });
    //           }

    //           if (asset.availableQuantity <= 0) {
    //             return res.status(400).send({ message: "Asset not available" });
    //           }

    // /* ===============================
    //          6️:  Assign asset  (ai khane employee and asset ar value ja peye ci already ta lagbe
    //       =============================== */

    // if(asset){

    //           const assignedAssetData = {
    //             assetId: new ObjectId(assetId), //check korte hobe object hisebe store hocce kina
    //             assetName: asset.productName,
    //             assetImage: asset.productImage,
    //             assetType: asset.productType,
    //             employeeEmail: employeeEmail,
    //             employeeName:employeeName,
    //             hrEmail: asset.hrEmail,
    //             companyName: asset.companyName,
    //             assignmentDate: new Date(),
    //             returnDate: null, //return korle date add kore dite hbe
    //             status: "assigned", //return korle "returned" kore dite hbe
    //           };

    //           const assignedResult = await assignedAssetsCollection.insertOne(
    //             assignedAssetData
    //           );

    //           if (!assignedResult.insertedId) {
    //             return res.status(500).send({ message: "Failed to assign asset" });
    //           }
    // }

    //  /* ===============================
    //          7️:Update asset quantity
    //       =============================== */
    //           const assetUpdateResult = await assetCollection.updateOne(
    //             { _id: new ObjectId(assetId) }, //object hisebe id pass hocce kina ta check korte hobe
    //             {
    //               $inc: { availableQuantity: -1 },
    //               $set: { updatedAt: new Date() },
    //             }
    //           );

    //           if (assetUpdateResult.modifiedCount === 0) {
    //             return res
    //               .status(500)
    //               .send({ message: "Failed to update asset quantity" });
    //           }

    //    /* ===============================
    //          8:Success response sesss
    //       =============================== */
    //           res.send({
    //             success: true,
    // 		result:assignedResult,
    //             message: "Asset request approved successfully",
    //           });

    //       }catch(err){
    //         console.error(err);
    //         res.status(500).send({ message: "Server error"})
    //       }
    //     })

    //new vabe:  //ai code ta new vabe kora holo...hr "remove" button click korle "employee"-->"affiliatedEmployee" list theke delete korte cina,just-->status: inactve korci....tai ai code ta update kore set korlam:
    app.patch("/directAssign/:id", verifyToken, verifyHr, async (req, res) => {
      const assetId = req.params.id;
      const { employeeEmail, employeeName } = req.body;
      const hrEmail = req.user.email;

      try {
        //package limit check:
        const hr = await userCollection.findOne({ email: hrEmail });
        if (!hr) {
          return res.status(404).send({ message: "HR not found" });
        }

        if (hr.currentEmployees >= hr.packageLimit) {
          return res.status(403).send({
            message: "Employee limit reached. Please upgrade your package.",
          });
        }
        // 1️ Check affiliation
        const affiliation = await employeeAffiliationsCollection.findOne({
          employeeEmail,
          hrEmail,
          status: "active",
        });

        if (!affiliation) {
          return res.status(403).send({
            message: "Employee is not affiliated with you",
          });
        }

        // 2️ Find asset
        const asset = await assetCollection.findOne({
          _id: new ObjectId(assetId),
          hrEmail,
        });

        if (!asset) {
          return res.status(404).send({ message: "Asset not found" });
        }

        if (asset.availableQuantity <= 0) {
          return res.status(400).send({ message: "Asset not available" });
        }

        // 3️ Assign asset
        const assignedAssetData = {
          assetId: asset._id,
          assetName: asset.productName,
          assetImage: asset.productImage,
          assetType: asset.productType,
          employeeEmail, //ai 3ta check korte hbe pore...
          employeeName,
          hrEmail,
          companyName: asset.companyName,
          returnDate: null,
          assignmentDate: new Date(),
          status: "assigned",
        };

        const assignedResult = await assignedAssetsCollection.insertOne(
          assignedAssetData
        );

        //---
        if (!assignedResult.insertedId) {
          return res.status(500).send({ message: "Failed to assign asset" });
        }

        // 4️ Update quantity
        await assetCollection.updateOne(
          { _id: asset._id },
          { $inc: { availableQuantity: -1 } }
        );

        res.send({
          success: true,
          result: assignedResult,
          message: "Asset assigned successfully",
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    //hr direct-assign-asset to "employee" (modal ar--> "Assign" button click korle ja hobe)--------(end)

    //**************(my employee page)******************** */
    //hr ar my employee page ar jonno data get kora holo--------------(start)
    app.get("/hr/my-employees", verifyToken, verifyHr, async (req, res) => {
      try {
        //hr token from jwt token:
        const hrEmail = req.user.email;

        //1:---Active affiliations(hrEmail, "active" status dea khujbo, tahole only fixed "hrEmail" ar jonnoi find hobe)
        const employees = await employeeAffiliationsCollection
          .find({ hrEmail, status: "active" })
          .toArray();

        //2:---Add asset count + profile image nibo akhn:
        const employeesWithAssets = await Promise.all(
          employees.map(async (emp) => {
            //asset count ar kaj korbo akhn:
            const assetCount = await assignedAssetsCollection.countDocuments({
              employeeEmail: emp.employeeEmail,
              hrEmail,
              status: "assigned",
            });

            //akhn employee profile image --> users collection theke nibo:
            const employeeUser = await userCollection.findOne(
              { email: emp.employeeEmail },
              //only profileImage paoa jabe...ai code dea ata bujai
              { projection: { profileImage: 1 } }
            );

            //akhn value gulu ke return korbo:
            return {
              _id: emp._id,
              employeeName: emp.employeeName,
              employeeEmail: emp.employeeEmail,
              employeePhoto: employeeUser?.profileImage || null,
              affiliationDate: emp.affiliationDate,
              assetCount,
            };
          })
        );

        //res:
        res.send(employeesWithAssets);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    //hr ar my employee page ar jonno data get kora holo--------------(end)

    //hr ar my-employee page ar jonno-->(currentEmployees+packageLimit) data get kora holo--------------(start)
    app.get("/hr/package-info", verifyToken, verifyHr, async (req, res) => {
      const hrEmail = req.user.email;

      const hr = await userCollection.findOne({ email: hrEmail });

      res.send({
        currentEmployees: hr.currentEmployees,
        packageLimit: hr.packageLimit,
      });
    });
    //hr ar my-employee page ar jonno-->(currentEmployees+packageLimit) data get kora holo--------------(end)

    //akhn hr jokhn "Remove" button click korbe -->(my employee page) theke...tokhn ja ja hobe tar code(employee remove hbe)---------(start)

    //ai "id" employeeAffiliation ar employee ar "id"----->
    app.patch(
      "/hr/remove-employee/:id",
      verifyToken,
      verifyHr,
      async (req, res) => {
        const id = req.params.id;
        const hrEmail = req.user.email;

        try {
          // 1️: Find active affiliation
          const affiliation = await employeeAffiliationsCollection.findOne({
            _id: new ObjectId(id),
            hrEmail,
            status: "active",
          });

          if (!affiliation) {
            return res.status(404).send({ message: "Employee not found" });
          }

          // 2️: Set affiliation inactive
          await employeeAffiliationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "inactive" } }
          );

          // 3️: Find assigned assets
          const assignedAssets = await assignedAssetsCollection
            .find({
              employeeEmail: affiliation.employeeEmail,
              hrEmail: affiliation.hrEmail,
              status: "assigned",
            })
            .toArray();

          // 4️: Return assets (quantity + request + assignedAssets)
          for (const asset of assignedAssets) {
            // increase quantity
            await assetCollection.updateOne(
              { _id: new ObjectId(asset.assetId) },
              { $inc: { availableQuantity: 1 } }
            );

            // // update request status (specific approved request)
            await requestsCollection.updateOne(
              {
                assetId: new ObjectId(asset.assetId),
                requesterEmail: asset.employeeEmail,
                hrEmail: asset.hrEmail,
                requestStatus: "approved",
              },
              { $set: { requestStatus: "returned" } }
            );
          }

          // 5️: Update assignedAssets status
          //note:
          // employee jokhn tar my asset page aa data get korbe,tokhn (hrEmail,employeeEmail,
          // status:assigned) ai 3ta condition set kore data get korte hbe....rr jokhn
          // status: "returned"...hobe tokhn rr data get korte parbe na...avabe remove button click korle..oi employee rr assign asset collection theke data get korte parbe na...mane asset gulu back hoa jabe
          await assignedAssetsCollection.updateMany(
            {
              employeeEmail: affiliation.employeeEmail,
              hrEmail: affiliation.hrEmail,
              status: "assigned",
            },
            {
              $set: {
                status: "returned",
                returnDate: new Date(),
              },
            }
          );

          // 6️: Decrease HR employee count
          await userCollection.updateOne(
            { email: hrEmail },
            { $inc: { currentEmployees: -1 } }
          );

          res.send({
            success: true,
            message: "Employee removed and assets returned successfully",
          });
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    //akhn hr jokhn "Remove" button click korbe -->(my employee page) theke...tokhn ja ja hobe tar code---------(end)
    //***************(my employee page)****************** */

    //hr jokhn asset request rejected korbe tar code----(start)
    app.patch(
      "/hr/asset-requests/reject/:id",
      verifyToken,
      verifyHr,
      async (req, res) => {
        //client side theke id pacci...tai id ta "string" hisebe pabo
        //ai req.body ar moddhe "requesCollection" ar data thakbe,client side ai datai patacci
        const requestId = req.params.id;
        //jwt token theke email:
        const hrEmail = req.user.email;
        //akhhn requestCollection aa ai "requestId" ar data ta ace kina ta check korbo:
        const request = await requestsCollection.findOne({
          _id: new ObjectId(requestId),
        });
        if (!request) {
          return res.status(404).send({ message: "Request not found" });
        }
        if (request.requestStatus !== "pending") {
          return res.status(400).send({ message: "Request already processed" });
        }
        if (request.hrEmail !== hrEmail) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        //akhhn requestCollection aa data update korbo:
        const updateDoc = {
          $set: {
            requestStatus: "rejected",
            processedBy: hrEmail,
          },
        };
        const updateRequestResult = await requestsCollection.updateOne(
          { _id: new ObjectId(requestId) },
          updateDoc
        );
        if (!updateRequestResult.modifiedCount) {
          return res.status(500).send({ message: "Failed to reject request" });
        }
        res.send({
          success: true,
          result: updateRequestResult,
          message: "Asset request rejected successfully",
        });
      }
    );
    //hr jokhn asset request rejected korbe tar code----(end)

    //akhn affiliations-employee der direct assign korar jonno get kora hocce-----(start)
    app.get(
      "/affiliations-employee",
      verifyToken,
      verifyHr,
      async (req, res) => {
        //age check korte hobe "employeeEmail" and "hrEmail" ace kina..jodi na thake tahole get hobe na

        //hr email from jwt token:
        const hrEmail = req.user.email;

        const employee = await employeeAffiliationsCollection
          .find({ hrEmail: hrEmail, status: "active" })
          .toArray();

        res.send(employee);
      }
    );
    //akhn affiliations-employee der direct assign korar jonno get kora hocce-----(end)

    //requestsCollection aa employee ar data post----------(start)
    app.post(
      "/asset-requests",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        const request = req.body;
        // console.log("Request body:", request);
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
          assetId: new ObjectId(request.assetId), // convert kora holo objectId te

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

    //*****************hr dashboard******************(start) */
    //----------------(hr profile)---------(start)
    //1: akhn hr info and affiliated info nibo:
    // HR profile get
    app.get("/hr/profile", verifyToken, verifyHr, async (req, res) => {
      try {
        const hrEmail = req.user.email;

        const user = await userCollection.findOne(
          { email: hrEmail, role: "hr" },
          {
            projection: {
              name: 1,
              email: 1,
              role: 1,
              companyName: 1,
              profileImage: 1,
              packageLimit: 1,
              currentEmployees: 1,
              subscription: 1,
              createdAt: 1,
              dateOfBirth: 1,
            },
          }
        );

        res.send({ user });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to load HR profile" });
      }
    });

    //2:akhn hr ar data update korbo:
    // HR profile update
    app.patch("/update/hrProfile", verifyToken, verifyHr, async (req, res) => {
      try {
        const hrEmail = req.user.email;
        const updateData = req.body;

        const result = await userCollection.updateOne(
          { email: hrEmail, role: "hr" },
          {
            $set: {
              ...updateData,
              updatedAt: new Date(),
            },
          }
        );

        res.send({ result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "HR profile update failed" });
      }
    });

    //----------------(hr profile)---------(end)


    //-----------(hr upgrade package page)--------(start)
    //1:--------akhn package load korbo:
     app.get("/packages/forHr",verifyToken,verifyHr,async(req,res)=>{
      const result = await packagesCollection.find({}).toArray();
      res.send(result);
    })


    //2: akhn upgrade button ke conditional korar jonno "userCollection" theke hr ar data get:
    app.get("/users/hr", verifyToken, verifyHr, async (req, res) => {
  const email = req.user.email;
  const hr = await userCollection.findOne({ email });
  res.send(hr);
});


  //---payment process: step:2.1(next step:3 client-side->hrPackageUpgrade) [akhn payment ar checkOut session make korbo] "post"
  app.post("/payment-checkout-session",verifyToken,verifyHr, async(req,res)=>{
    try{
      const hrEmaill = req.user.email;
    //1:client side theke data nibo:
    const paymentInfo = req.body;

      //amount ke "parseInt" kore nite hobe...jeno intiger/number paoa jai,calculate korar jonno
      //2:amount: cent a hisab korte hobe,tai 100 dea multipy kora hoi ce.
      const amounts = parseInt(paymentInfo.amount) * 100;

      //3:
    const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
        price_data: {
           currency: "USD",
              //amount ta "cent" ar hisebe hobe,,1500cent
              unit_amount: amounts,

              //price_data ar child hocce: "product_data"
              product_data: {
                //PRODUCT ar info: strip aaa pay korar page aa show hobe
                name: `Please pay for ${paymentInfo.packageName}`,
              },
        },
        //ame akti package kinte payment korbo,tai "quantity=1"
        quantity: 1,
      },
    ],
   //extra add kora holo: customer email [APIs & SDKs-->https://docs.stripe.com/api/checkout/sessions/create]-->ai khane code ace..api related
         //
        mode: "payment",
        // hrEmail: hrEmaill, 
        //atao add kora holo:
        metadata: {
          hrId: paymentInfo.hrId,  //ata dea userCollection aa tikh "hr" ke khujbo
          packageName: paymentInfo.packageName,

          //ai 2ta new vabe add kora holo----------------**
          employeeLimit: paymentInfo.employeeLimit,
          // amount: paymentInfo.amount,
           hrEmail: hrEmaill, //ata akhane add kora holo

          //2:--(same trackingId rakhar code)---"session" ar moddhe "trackingId" add kore dilam...client side theke send kora hoice "trackingId"
          // trackingId: paymentInfo.trackingId,  //---drkr hole use kora hobe
        },
    //payment completed hole akta success page ase...sei page asar jonno akta url(jei url(client-side url) aa show hobe) lagbe...sei url tai-->YOUR_DOMAIN ss set korbo
    //payment success hoa gele je page aa jabe...sei componet client side aa make kore,sei page aa jaoar "route(path: "payment-success",Component: PaymentSuccess,)" router aa set kore...oi page ar "url" ta akhane bosabo..jeno success hole ai url link use kore "success page" ta client ar -->"PaymentSuccess" page aa ase



    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,


    // jodi payment korte gea cancelled hoa jai tahole ata back korbe
        // cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,

        //akhn-->paymentCollection ar status:failed ar kaj--> cancel ar kaj korbo-->1:
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled?session_id={CHECKOUT_SESSION_ID}`,

  });
  //  console.log('session data:',session);


  //  PENDING payment add korlam...ai line aa client side aa just strip page open hoa--add korlam:1
  // const pendingPayment = {
  //   hrEmail: hrEmaill,
  //   packageName: paymentInfo.packageName,
  //   employeeLimit: Number(paymentInfo.employeeLimit),
  //   amount: amounts/100,
  //   status: "pending",
  //   sessionId: session.id,
  //   createdAt: new Date(),
  // };

  // await paymentCollection.insertOne(pendingPayment);
      //client side aa send kora holo: akti object ar moddhe "url" property name dea...
      //kaj korle client side akti "url" res hisebe jabe

      //new vabe:------------->
       await paymentCollection.updateOne(
      { hrEmail: hrEmaill, packageName: paymentInfo.packageName },
      {
        $set: {
          hrEmail: hrEmaill,
          packageName: paymentInfo.packageName,
          amount: amounts / 100,
          employeeLimit: Number(paymentInfo.employeeLimit),
          status: "pending",
          sessionId: session.id,
          updatedAt: new Date(),
        },
        // ata(setOnInsert) only insert ar time aa active hobe
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      // upsert: true thakle match ar time aa data na peleo ai info gulu insert hobe first time..
      { upsert: true }
    );
      
      res.send({ url: session.url });
    }catch(err){
      console.error(err);
      res.status(500).send({success: false})
    }
  })
  

  //---payment process: step:2.2(/payment-success)  (client side ar "PaymentSuccess.jsx" page theke "session_id" receive kore-->"patch(`/payment-success?session_id=${sessionId}`)" ar moddhe me--> server-side aa send kora hoice, mane payment complete hoi ce)
  app.patch("/payment-success",verifyToken,verifyHr,async(req,res)=>{
    //client side theke "session id" server aa send kora hoice-->"session_id" name aa,setai receive korbo:
      //1:Stripe success page থেকে session_id query হিসাবে আসবে
      const sessionId = req.query.session_id;



       //id jokhon peye jabo...client-side theke tokhon:-->"retrieve-->mane data ke nea asbo"
      //2:ai line dea Stripe-ar session database aa je  payment info ace — seta ame server theke fetch korci..
      const session = await stripe.checkout.sessions.retrieve(sessionId);


      //3:
       if (session.payment_status !== "paid") {
        return res.send({ success: false }); // এখানে safe
      }


      //4:
        //-----(start)----(problem with solution)-------app.patch ai code ta complete krar pore akti problem hocce,same data 2bar data-base aa store hocce,
      //solution:tai akhn amra "transactionId" dea condition set korbo,jeno same "transactionId" dea repeat kono data store na hote pare

      //akbar payment complete hole then repeat data store hole ai code activve korbo------

      // //"transactionId" ta nea nibo---(ata payment complete hole,cmd te paoa jai)
      const transactionId = session.payment_intent;
      //ai id query te set korbo:
      const paymentQuery = { transactionId: transactionId };
      //ai query dea "data-base" aa "findOne" korbo je ai data ace kina:
      const paymentExist = await paymentCollection.findOne(paymentQuery);

      // console.log("paymentExist", paymentExist); //jei data match korbe,seta akhane paoa jabe

      //jodi already thake,tahole "return" kore dibo:..mane akbar data store houar pore,second time jokhon store hote nibe,tokhon rr hobe na,return hoa jabe..

       if (paymentExist) {
        //ai line thekei return hoa jabe
        //jei data match korbe tar -->trackingId,transactionId..client side aa send kore dilam,
        return res.send({
          message: "already exits this in db:",
          transactionId,
          // trackingId: paymentExist.trackingId, //drkr hole use kora hobe
        });
      }

       //-----(end)----(problem with solution)---


      //  "session.meta" ar vitore already je "trackingId" ace oi tai ai line aa set kore dibo
      //5:--(same trackingId rakhar code)
      // const trackingId = session.metadata.trackingId; //drkr hole use kora hobe


        //6:
        if (session.payment_status === "paid"){

           //ame je id(ata data-base je data ace oi "_id" tai,,client-side theke set kore pathai cilam) set kore cilam...metadata te,seta nibo
        const hrId = session.metadata.hrId;
        // ai id ke data-base ar "id" ar format aa nibo:
        const query = { _id: new ObjectId(hrId) };

         //baki code ai link a kora thake:mongodb docs: https://www.mongodb.com/docs/drivers/node/current/crud/update/
        const update = {
          $set: {
            packageLimit: Number(session.metadata.employeeLimit),
            subscription: session.metadata.packageName, 
            updatedAt: new Date(),
          },
        };

         const updateHrInfo = await userCollection.updateOne(query, update);

         //akhane akta "res" add korte hobe


         //7:-------------------***********--------paymentCollection aa data insert korar code:
          //ai data gulu keo ame add korbo: payment success jokhon hobe tokhon ai khane ai data gulu pabo,then new "collection-->(paymentCollection)" a add korbo niche...----(start)
        //1:-------------key:(with tracking info)
        //paymentCollection ar data match korar jonno ai 2ta field use korbo:
         const hrEmail = session.metadata.hrEmail;
    const packageName = session.metadata.packageName;
        const paymentUpdate = {
          amount: session.amount_total / 100, //100 dea divide korlam,karon "amount" ta "cent" hisebe ascilo,tai 100 dea divide kore doller kore nilam,
          hrEmail: session.metadata.hrEmail,
          packageName: session.metadata.packageName,
          employeeLimit: Number(session.metadata.employeeLimit),
         

          //taka je transition hoa ce,mane-->"transition id-->( payment_intent)", atao add korlam:
          transactionId: session.payment_intent,
          //status:
          status: "completed",
          //date add kora holo:
          paymentDate: new Date(),
          sessionId,

          //tracking id oo data ar moddhe add kore dilam:
          // trackingId: trackingId,
        };

        //jodi taka pay hoa thake,tahole ai line a asbe,akhn amra akti new "data-collection" make kore data ai "payment" korar data gulu add kore dibo
        if (session.payment_status === "paid") {
         
          try {
            // const resultPayment = await paymentCollection.insertOne(payment);
            const updatePayment = await paymentCollection.updateOne( { hrEmail, packageName },
    { $set: {...paymentUpdate} });

         

            return res.send({
              success: true,
              modifyUserCollection: updateHrInfo,
              // trackingId: trackingId,  //drkr hole use kora hobe
              transactionId: session.payment_intent,
              paymentInfo: updatePayment,
            });
          } catch (err) {
            //11000 = duplicate transactionId (MongoDB auto-block)
            if (err.code === 11000) {
              // old payment record-ar tracking ber kore dibe
              const oldPayment = await paymentCollection.findOne({
                transactionId,
              });

              return res.send({
                success: true,
                message: "Payment already stored before",
                trackingId: oldPayment?.trackingId,
                transactionId,
              });
            }

            return res.status(500).send({ success: false, error: err });
          }
        }


        }

  })


  //akhn payment failed hole...ai api te hit korbe...client(PaymentCancelled.jsx) theke:
  app.patch("/payment-failed",verifyToken,verifyHr, async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).send({ success: false, message: "Session ID missing" });
    }

    // Stripe session retrieve
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // already completed hole failed kora jabe na
    if (session.payment_status === "paid") {
      return res.send({
        success: false,
        message: "Payment already completed",
      });
    }


    //paymentCollection aa data match korar jonno ai 2ta field use korbo:
    const hrEmail = session.metadata.hrEmail;
    const packageName = session.metadata.packageName;

    // paymentCollection update → failed
    const updateResult = await paymentCollection.updateOne(
      { hrEmail, packageName },
      {
        $set: {
          status: "failed",
          // paymentDate: new Date(),
        },
      }
    );

    return res.send({
      success: true,
      message: "Payment marked as failed",
      updateResult,
    });

  } catch (error) {
    console.error("Payment failed update error:", error);
    res.status(500).send({ success: false, error });
  }
});

    //-----------(hr upgrade package page)--------(end)


    //----------chart show-------(start)
    //------------1:
    app.get("/asset-type-summary", verifyToken,verifyHr, async (req, res) => {
  try {
    const email = req.user.email;

    const result = await assetCollection.aggregate([
      { $match: { hrEmail: email } },

      {
        $group: {
          _id: "$productType",
          count: { $sum: 1 },
        },
      },

      {
        $project: {
          _id: 0,
          name: {
            $cond: [
              { $eq: ["$_id", "Returnable"] },
              "Returnable",
              "Non-returnable",
            ],
          },
          value: "$count",
        },
      },
    ]).toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: true });
  }
});



//----------------------2:
app.get("/top-requested-assets", verifyToken,verifyHr, async (req, res) => {
  try {
    const email = req.user.email;

    const result = await requestsCollection.aggregate([
      { $match: { hrEmail: email } },

      {
        $group: {
          _id: "$assetName",
          count: { $sum: 1 },
        },
      },

      { $sort: { count: -1 } },

      { $limit: 5 },

      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
    ]).toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: true });
  }
});



    //----------chart show-------(end)

    //*****************hr dashboard******************(end) */

    //edit asset ar jonno data get---------(end)
    //*************(employee  dashboard)**************(start)* */

    //-----------------------1:
    //employee ar request asset ar jonno data get "assectCollection" theke-------(start)
    app.get("/asset/available", async (req, res) => {
      //$gt = greater than
      // { $gt: 0 } mane 0 theke boro amn data gulu get hobe

      const query = { availableQuantity: { $gt: 0 } };
      const assets = await assetCollection.find(query).toArray();
      res.send(assets);
    });
    //employee ar request asset ar jonno data get "assectCollection" theke-------(end)

    //-----------------------2:(My Asset)
    //akhn employee ar "My Asset" page ar jonno data get-->"assignAssetCollection" theke...and (search+ filter) soho code--------(start)
    app.get(
      "/employee/my-assets",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        //try-catch use kore:

        try {
          //1: jwt token theke "employee" ar email nea:
          const employeeEmail = req.user.email;

          //2: client-side theke "search", "filter" ar value asbe...sei value gulu receive korbo:-->note: "?" mark ar pore value gulu send kora hoace.tai "query" ar moddhe pabo...

          //""--> dilam...jodi kono value na pai,tahole "empty" string set hobe,then all value get(retunable, non-retunable) hobe...
          const { searchText = "", type = "" } = req.query;

          //3: akhn "query" set korbo:

          let query = {
            employeeEmail: employeeEmail,
            status: "assigned",
          };

          //4:"type" ar value dea get korar jonno-->"query" set kora holo:
          if (type) {
            query.assetType = type;
          }

          //5: asset name dea search..ar value "query" te set korlam:
          if (searchText) {
            query.assetName = { $regex: searchText, $options: "i" };
          }

          //6: akhn "find" korbo-->"assignedAssetsCollection" ar moddhe:
          const assets = await assignedAssetsCollection
            .find(query)
            .sort({ assignmentDate: -1 })
            .toArray();

          //data get from "multiple--> collection":  ----testing
          //2:---Add asset count + profile image nibo akhn:
          const employeesWithAssets = await Promise.all(
            assets.map(async (emp) => {
              //akhn employee profile image --> users collection theke nibo:
              const employeeUser = await requestsCollection.findOne(
                {
                  assetId: emp.assetId,
                  requesterEmail: employeeEmail,
                  requestStatus: "approved",
                },
                { sort: { requestDate: -1 } }
              );

              //akhn value gulu ke return korbo:
              //Asset Image, Asset Name, Asset Type (Returnable/Non-returnable), Company Name, Request Date, Approval Date, Status
              return {
                assetImage: emp.assetImage,
                assetName: emp.assetName,
                assetType: emp.assetType,
                companyName: emp.companyName,
                assignmentDate: emp.assignmentDate,
                status: emp.status,
                requestDate: employeeUser?.requestDate || null,
                requestStatus: employeeUser?.requestStatus,
              };
            })
          );
          //---------------------------(end)-----testing

          res.send(employeesWithAssets);
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );
    //akhn employee ar "My Asset" page ar jonno data get-->"assignAssetCollection" theke...and (search+ filter) soho code--------(end)

    //----------------3:(My team)
    //akhn employee ar team ar jonno data get korbo----------(start)
    //Get Companies Where Employee Is Affiliated

    app.get(
      "/employee/my-companies",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        try {
          const employeeEmail = req.user.email;

          const affiliations = await employeeAffiliationsCollection
            .find({ employeeEmail, status: "active" })
            .toArray();

          //akhn ai companies gulu theke amr "companyName" gulu drkr..tai map use korbo:
          //new set()--> use korle duplicate data asbe na...
          //amr value gulu array hisebe drkr,tai []--> ar moddhe set koreci
          const companies = affiliations.map((item) => item.companyName);
          res.send(companies);
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );
    //akhn employee ar team ar jonno data get korbo----------(end)

    //akhn oi company ar sathe rr jara jara connected ace...tader get korbo------(start)
    app.get(
      "/my-team/employee",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        try {
          const employeeEmail = req.user.email;
          const { companyName } = req.query;

          if (!companyName) {
            return res.status(400).send({ message: "Company required" });
          }

          // now-->find all colleagues in same company
          const team = await employeeAffiliationsCollection
            .find({ companyName, status: "active" })
            .toArray();

          //akhn "userCollection" theke "role, photo,date Of birth,get korbo:
          const teamWithProfile = await Promise.all(
            team.map(async (member) => {
              const user = await userCollection.findOne(
                { email: member.employeeEmail },
                { projection: { profileImage: 1, dateOfBirth: 1, role: 1 } }
              );

              //akhn value gulu retun korbo:
              return {
                name: member.employeeName,
                email: member.employeeEmail,
                position: user?.role || null,
                photo: user?.profileImage || null,
                dateOfBirth: user?.dateOfBirth || null,
              };
            })
          );

          res.send(teamWithProfile);
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );
    //akhn oi company ar sathe rr jara jara connected ace...tader get korbo------(end)

    //akhn "up-coming-->birthday get korar code"-----------(start)
    app.get(
      "/upcoming-birthdays/employee",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        try {
          const employeeEmail = req.user.email;

          //akhn up-coming month get korar jonno ai code ta set korte hobe:
          //ata aj ker (current month) ber kore dai
          const month = new Date().getMonth();

          //1:akhn employee nijer email dea.."affiliatedCollection" theke tar company/company-->"ai company gulur sathe onno employee connected ace" gulur data nea nibo
          //reminder: ai code dea only "employee" nijer company gulu pabe
          const affiliations = await employeeAffiliationsCollection
            .find({ employeeEmail, status: "active" })
            .toArray();

          //2: akhn ai company gulur data theke -->"companyName" gulu nea nibo:
          const companyNames = affiliations.map((data) => data.companyName);

          //3:akhn "companyName" dea "affiliationCollection" theke -->ai "companyName" dea joto data ace sob get korbo... ai data gulu te nijer and onno employee ar email oo paoa jabe...

          const team = await employeeAffiliationsCollection
            .find({ companyName: { $in: companyNames }, status: "active" })
            .toArray();

          //akhn up-coming birstday related code:
          let birthdays = [];

          //ai variable aa email set korbo,jeno check korte pari same email ar data "birthday" variable aa set na hoa
          let addedEmails = [];

          //akhn ai "team" ar moddhe employee der "email" ace...ai email dea "userCollection" theke date of birth gulu nea nibo:
          //akta akta kore "employee" ar data dea -->"userCollection" aa "findOne" korbo tai:
          for (const member of team) {
            // agei email add kora thakle skip hoa jabe...mane repeat ai same emai ar data -->birthdays ar moddhe set hobe na
            if (addedEmails.includes(member.employeeEmail)) {
              //jodi agei same kono email add hoa jabe...tahole -->continue mane --> এই loop iteration skip করো
              // nicher kono code cholbe na
              //direct next member a jabe
              continue;
            }

            const user = await userCollection.findOne(
              { email: member.employeeEmail },
              {
                projection: { dateOfBirth: 1, profileImage: 1 },
              }
            );

            //akhn check dibo upcoming month ace kina dateOfBirth ar moddhe:
            if (
              user?.dateOfBirth &&
              new Date(user.dateOfBirth).getMonth() === month
            ) {
              birthdays.push({
                name: member.employeeName,
                photo: user.profileImage || null,
                dateOfBirth: user.dateOfBirth,
              });

              // ai email "addEmails" ar moddhe push korlam...jeno second time ai same email asle oporer--->if (addedEmails.includes(member.employeeEmail))  ai line aa check korte pare
              addedEmails.push(member.employeeEmail);
            }
          }

          res.send(birthdays);
        } catch (err) {
          console.log(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );
    //akhn "up-coming-->birthday get korar code"-----------(end)

    //------------------------4: (Employee Profile)

    //akhn employee ar "email,photo" get korbo-->"userCollection" theke--------(start)
    app.get(
      "/profile/employee",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        try {
          const employeeEmail = req.user.email;

          //userCollection theke email,photo,name,photo,role nilam
          const user = await userCollection.findOne(
            { email: employeeEmail, role: "employee" },
            {
              projection: {
                name: 1,
                email: 1,
                role: 1,
                dateOfBirth: 1,
                profileImage: 1,
              },
            }
          );
          // console.log('user data:', user);

          //current affiliated company ar info nilam:
          const affiliations = await employeeAffiliationsCollection
            .find(
              { employeeEmail: employeeEmail, status: "active" },
              { projection: { companyName: 1, affiliationDate: 1 } }
            )
            .toArray();

          res.send({ user, affiliations });

          // 3️: only company names
          // const companies = affiliations.map(a => a.companyName);

          //     //akhn ai 2ta datai send kore dibo:
          //     res.send({user, companies})

          //new vabe:
          //akhn "userCollection" theke "role, photo,date Of birth,get korbo:
          // const EmployeeProfile = await Promise.all(
          //   user.map(async (member) => {
          //     const user = await employeeAffiliationsCollection.findOne(
          //       { employeeEmail: member.email,status: "active" },
          //       { projection: { companyName: 1} }
          //     );

          //     //akhn value gulu retun korbo:
          //     return {
          //       name: member.name,
          //       email: member.email,
          //       position: member.role,
          //       photo: member?.profileImage || null,
          //       companyName: user.companyName,
          //     };
          //   })
          // );
          // res.send(EmployeeProfile)
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Failed to load profile" });
        }
      }
    );
    //akhn employee ar "email,photo" get korbo-->"userCollection" theke--------(end)

    //akhn employee ar "profile image+other info" update korbo--------(start)
    app.patch(
      "/update/employeeProfileImage",
      verifyToken,
      verifyEmployee,
      async (req, res) => {
        try {
          const employeeEmail = req.user.email;

          //client side theke je data send koreci,ta receive korbo:
          const employeeData = req.body;
          // console.log('employee data:', employeeData)
          // const {} = employeeData;

          //update info:
          const updateInfo = {
            $set: {
              ...employeeData,
              updatedAt: new Date(),
            },
          };
          const result = await userCollection.updateOne(
            { email: employeeEmail, role: "employee" },
            updateInfo
          );

          res.send({ result });
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Profile update failed" });
        }
      }
    );
    //akhn employee ar "profile image" update korbo--------(end)

    //*************(employee  dashboard)**************(end)* */

    //Asset list ar data paoar  jonno-------(start)
  

    //new vabe:
    // app.get("/assets", verifyToken, verifyHr, async (req, res) => {
    //   const { email, searchText } = req.query;

    //   const tokenEmail = req.user.email;
    //   if (tokenEmail !== email) {
    //     return res.status(403).send({ message: "Forbidden access" });
    //   }

    //   const user = await userCollection.findOne({ email });
    //   if (!user) {
    //     return res.status(404).send({ message: "User not found" });
    //   }

    //   let query = {};

    //   if (searchText) {
    //     query.$or = [
    //       { companyName: { $regex: searchText, $options: "i" } },
    //       { productName: { $regex: searchText, $options: "i" } },
    //     ];
    //   }

    //   if (user.role === "hr") {
    //     query.hrEmail = email;

    //     const result = await assetCollection
    //       .find(query)
    //       .sort({ dateAdded: -1 })
    //       .limit(10)
    //       .toArray();

    //     return res.send(result);
    //   }

    //   return res.status(403).send({ message: "Access denied" });
    // });

    //akhn pagination ar code add kore final kora holo:
    // Asset list with SERVER-SIDE PAGINATION
app.get("/assets", verifyToken, verifyHr, async (req, res) => {
  const { email, searchText, page = 1, limit = 10 } = req.query;

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

    const skip = (Number(page) - 1) * Number(limit);

    const assets = await assetCollection
      .find(query)
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    const total = await assetCollection.countDocuments(query);

    return res.send({
      assets,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
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
