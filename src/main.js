const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");

const dbName = "StudentDB";
const collections = {
  fields: "Fields",
  content: "Content",
  fields_content: "Fields_content"
};
const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

console.log(process.env.database);

const client = new MongoClient(process.env.database, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  }
}

connectToMongoDB();

app.post("/create/student", async (req, res) => {
  try {
    const data = req.body;
    const db = client.db(dbName);

    const contentCollection = db.collection(collections.content);
    const fieldsCollection = db.collection(collections.fields);
    const fieldContentCollection = db.collection(collections.fields_content);

    const keys = Object.keys(data);

    for (const key of keys) {
      const existingField = await fieldsCollection.findOne({ fieldName: key });
      if (!existingField) {
        await fieldsCollection.insertOne({ fieldName: key });
      }

      await contentCollection.insertOne({ content: data[key] });
    }

    const fieldContent = [];
    for (const key of keys) {
      const field = await fieldsCollection.findOne({ fieldName: key });
      const content = await contentCollection.findOne({ content: data[key] });
      fieldContent.push({ field_id: field._id, content_id: content._id });
    }

    await fieldContentCollection.insertOne({ fields: fieldContent });

    res.status(201).send("Student record added successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding student record.");
  }
});

app.get("/students", async (req, res) => {
  try {
    const db = client.db(dbName);

    const fieldContents = await db.collection(collections.fields_content).find().toArray();

    const students = [];
    for (const fieldContent of fieldContents) {
      const fields = [];
      for (const field of fieldContent.fields) {
        const fieldInfo = await db.collection(collections.fields).findOne({ _id: new ObjectId(field.field_id) });

        const contentInfo = await db.collection(collections.content).findOne({ _id: new ObjectId(field.content_id) });

        fields.push({ fieldName: fieldInfo.fieldName, content: contentInfo.content });
      }
      students.push({ id: fieldContent._id, fields: fields });
    }
    res.status(200).json(students);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving students data.");
  }
});

app.put("/update/student/:id", async (req, res) => {
  const studentId = req.params.id;
  const newData = req.body;

  try {
    const db = client.db(dbName);

    const fieldContent = await db.collection(collections.fields_content).findOne({ _id: new ObjectId(studentId) });
    if (!fieldContent) {
      return res.status(404).send("Student not found.");
    }

    const updatedFields = [];
    for (const key in newData) {
      let existingField = await db.collection(collections.fields).findOne({ fieldName: key });
      if (!existingField) {
        existingField = await db.collection(collections.fields).insertOne({ fieldName: key });
      }

      let existingContent = await db.collection(collections.content).findOne({ content: newData[key] });
      if (!existingContent) {
        existingContent = await db.collection(collections.content).insertOne({ content: newData[key] });
      }

      updatedFields.push({ field_id: existingField._id, content_id: existingContent._id });
    }

    await db.collection(collections.fields_content).updateOne({ _id: new ObjectId(studentId) }, { $set: { fields: updatedFields } });

    res.status(200).send("Student record updated successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating student record.");
  }
});

app.listen(8600, () => {
  console.log("Server running on port 8600");
});
