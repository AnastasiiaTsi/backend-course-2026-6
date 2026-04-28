const { Command } = require('commander');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');

const program = new Command();

program
  .requiredOption('-h, --host <type>')
  .requiredOption('-p, --port <type>')
  .requiredOption('-c, --cache <type>');

program.parse(process.argv);
const options = program.opts();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

let inventory = [];
let idCounter = 1;

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Inventory Service API",
    version: "1.0.0",
    description: "Lab 6 - Inventory Service"
  },
  paths: {
    "/inventory": {
      get: { summary: "Get all items", responses: { 200: { description: "OK" } } }
    },
    "/inventory/{id}": {
      get: { summary: "Get item by ID", responses: { 200: {}, 404: {} } },
      put: { summary: "Update item", responses: { 200: {}, 404: {} } },
      delete: { summary: "Delete item", responses: { 200: {}, 404: {} } }
    },
    "/register": {
      post: { summary: "Register item", responses: { 201: {}, 400: {} } }
    },
    "/inventory/{id}/photo": {
      get: { summary: "Get photo", responses: { 200: {}, 404: {} } },
      put: { summary: "Update photo", responses: { 200: {}, 404: {} } }
    },
    "/search": {
      post: { summary: "Search item", responses: { 200: {}, 404: {} } }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// GET all
app.get('/inventory', (req, res) => {
  res.json(inventory);
});

// GET by ID
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).send('Not found');

  res.json(item);
});

// CREATE
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).send('Name is required');
  }

  const item = {
    id: idCounter++,
    name: inventory_name,
    description: description || '',
    photo: req.file ? req.file.filename : null
  };

  inventory.push(item);

  res.status(201).json(item);
});

// UPDATE
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).send('Not found');

  const { name, description } = req.body;

  if (name) item.name = name;
  if (description) item.description = description;

  res.json(item);
});

// DELETE
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) return res.status(404).send('Not found');

  inventory.splice(index, 1);

  res.send('Deleted');
});

// GET photo
app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item || !item.photo) {
    return res.status(404).send('Not found');
  }

  const filePath = path.join(__dirname, 'uploads', item.photo);

  res.set('Content-Type', 'image/jpeg');
  res.sendFile(filePath);
});

// UPDATE photo
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).send('Not found');

  item.photo = req.file ? req.file.filename : item.photo;

  res.json(item);
});

// REGISTER FORM
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

// SEARCH FORM
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

// SEARCH
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;

  const item = inventory.find(i => i.id === parseInt(id));

  if (!item) return res.status(404).send('Not Found');

  let result = { ...item };

  if (has_photo) {
    result.photoUrl = `/inventory/${item.id}/photo`;
  }

  res.json(result);
});

app.use((req, res) => {
  res.status(405).send('Method Not Allowed');
});

app.listen(options.port, options.host, () => {
  console.log(`http://${options.host}:${options.port}`);
});