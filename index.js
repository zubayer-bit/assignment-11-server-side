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

          //akhn ai "team" ar moddhe employee der "email" ace...ai email dea "userCollection" theke date of birth gulu nea nibo:
          //akta akta kore "employee" ar data dea -->"userCollection" aa "findOne" korbo tai:
          for (const member of team) {
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

    //*************(employee  dashboard)**************(end)* */

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
