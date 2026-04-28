const { Command } = require('commander');

const program = new Command();

program
    .requiredOption('-h, --host <type>')
    .requiredOption('-p, --port <type>')
    .requiredOption('-c, --cache <type>');

program.parse(process.argv);
const options = program.opts();

const express = require('express');

const app = express();

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

let inventory = [];
let idCounter = 1;

//для JSON, form-data 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// GET 
app.get('/inventory', (req, res) => {
  const id = parseInt(req.params.id);

  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).send('Not found');
  }

  res.json(item);
});

//POST
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

app.listen(options.port, options.host, () => {
  console.log(`http://${options.host}:${options.port}`);
});