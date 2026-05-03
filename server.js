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

const cacheDir = path.resolve(options.cache);

// Створення cache директорії
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, cacheDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JSON файл
const dataFile = path.join(cacheDir, 'inventory.json');

let inventory = [];
let idCounter = 1;

function loadData() {
  if (fs.existsSync(dataFile)) {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    inventory = data.inventory || [];
    idCounter = data.idCounter || 1;
  }
}

function saveData() {
  fs.writeFileSync(
    dataFile,
    JSON.stringify({ inventory, idCounter }, null, 2)
  );
}

loadData();

// Swagger
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Inventory Service API',
    version: '1.0.0',
    description: 'Lab 6 - Inventory Service'
  },
  paths: {
    '/inventory': {
      get: {
        summary: 'Get all items',
        responses: { 200: { description: 'OK' } }
      }
    },
    '/inventory/{id}': {
      get: {
        summary: 'Get item by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } }
      },
      put: {
        summary: 'Update item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } }
      },
      delete: {
        summary: 'Delete item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } }
      }
    },
    '/register': {
      post: {
        summary: 'Register item',
        responses: { 201: { description: 'Created' }, 400: { description: 'Bad Request' } }
      }
    },
    '/inventory/{id}/photo': {
      get: {
        summary: 'Get photo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } }
      },
      put: {
        summary: 'Update photo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } }
      }
    },
    '/search': {
      post: {
        summary: 'Search item',
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// GET all
app.get('/inventory', (req, res) => {
  res.json(
    inventory.map(item => ({
      ...item,
      photoUrl: `/inventory/${item.id}/photo`
    }))
  );
});

// GET by ID
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).json({ error: 'Not found' });

  res.json({
    ...item,
    photoUrl: `/inventory/${item.id}/photo`
  });
});

// CREATE
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const item = {
    id: idCounter++,
    name: inventory_name,
    description: description || '',
    photo: req.file ? req.file.filename : null
  };

  inventory.push(item);
  saveData();

  res.status(201).json({
    ...item,
    photoUrl: `/inventory/${item.id}/photo`
  });
});

// UPDATE item
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).json({ error: 'Not found' });

  const { name, description } = req.body;

  if (name) item.name = name;
  if (description) item.description = description;

  saveData();

  res.json({
    ...item,
    photoUrl: `/inventory/${item.id}/photo`
  });
});

// DELETE
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) return res.status(404).json({ error: 'Not found' });

  const item = inventory[index];

  if (item.photo) {
    const photoPath = path.join(cacheDir, item.photo);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  inventory.splice(index, 1);
  saveData();

  res.json({ message: 'Deleted' });
});

// GET photo 
app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item || !item.photo) {
    return res.status(404).send('Not found');
  }

  res.sendFile(item.photo, {
    root: cacheDir
  });
});

// UPDATE photo
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).json({ error: 'Not found' });

  if (!req.file) {
    return res.status(400).json({ error: 'Photo is required' });
  }

  if (item.photo) {
    const oldPath = path.join(cacheDir, item.photo);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  item.photo = req.file.filename;
  saveData();

  res.json({ message: 'Photo updated' });
});

// Forms
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

// SEARCH
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find(i => i.id === parseInt(id));

  if (!item) return res.status(404).send('Not Found');

  let result =
    `ID: ${item.id}\nName: ${item.name}\nDescription: ${item.description}`;

  if (has_photo === 'on') {
    result += `\nPhoto URL: /inventory/${item.id}/photo`;
  }

  res.send(result);
});

// 405 handler
app.use((req, res) => {
  res.status(405).send('Method Not Allowed');
});

app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
  console.log(`Cache directory: ${cacheDir}`);
  console.log(`Swagger docs: http://${options.host}:${options.port}/api-docs`);
});