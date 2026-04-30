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

// Створення cache директорії
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

// Налаштування multer для збереження в cache
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, options.cache);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Завантаження даних з файлу
const dataFile = path.join(options.cache, 'inventory.json');
let inventory = [];
let idCounter = 1;

function loadData() {
  if (fs.existsSync(dataFile)) {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    inventory = data.inventory;
    idCounter = data.idCounter;
  }
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify({ inventory, idCounter }, null, 2));
}

loadData();

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

// GET all - включає посилання на фото
app.get('/inventory', (req, res) => {
  const itemsWithPhotoUrl = inventory.map(item => ({
    ...item,
    photoUrl: `/inventory/${item.id}/photo`
  }));
  res.json(itemsWithPhotoUrl);
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

// UPDATE
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

// DELETE - видаляє і файл фото
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) return res.status(404).json({ error: 'Not found' });

  const item = inventory[index];
  
  // Видалення файлу фото
  if (item.photo) {
    const photoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  inventory.splice(index, 1);
  saveData();

  res.status(200).json({ message: 'Deleted' });
});

// GET photo
app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item || !item.photo) {
    return res.status(404).send('Not found');
  }

  const filePath = path.join(options.cache, item.photo);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Photo file not found');
  }

  res.set('Content-Type', 'image/jpeg');
  res.sendFile(filePath);
});

// UPDATE photo
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).json({ error: 'Not found' });

  if (!req.file) {
    return res.status(400).json({ error: 'Photo is required' });
  }

  // Видалення старого фото
  if (item.photo) {
    const oldPhotoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }

  item.photo = req.file.filename;
  saveData();

  res.status(200).json({ message: 'Photo updated' });
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

  let result = `ID: ${item.id}\nName: ${item.name}\nDescription: ${item.description}`;
  
  if (has_photo === 'on') {
    result += `\nPhoto URL: /inventory/${item.id}/photo`;
  }

  res.send(result);
});

// Обробка непідтримуваних методів
app.use((req, res) => {
  res.status(405).send('Method Not Allowed');
});

app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
  console.log(`Cache directory: ${options.cache}`);
  console.log(`Swagger docs: http://${options.host}:${options.port}/api-docs`);
});




//http://localhost:3000/RegisterForm.html
//http://localhost:3000/SearchForm.html
//http://localhost:3000/