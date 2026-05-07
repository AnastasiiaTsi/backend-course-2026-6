const { Command } = require('commander');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const { pool } = require('./db');
require('dotenv').config();  // додати на початку файлу

const program = new Command();

program
  .option('-h, --host <type>', 'server host', '0.0.0.0')
  .option('-p, --port <type>', 'server port', '3000')
  .option('-c, --cache <type>', 'cache dir', 'cache');  // Changed from './cache' to 'cache' to avoid path issues

program.parse(process.argv);
const options = program.opts();

/* ===================== CACHE ===================== */

const cacheDir = path.resolve(options.cache || 'cache');  // Added fallback

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

/* ===================== MULTER ===================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cacheDir),
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

/* ===================== EXPRESS ===================== */

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===================== SWAGGER ===================== */

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Inventory Service API',
    version: '1.0.0',
    description: 'Lab 7 - Inventory Service (Postgres)'
  },
  paths: {
    '/inventory': {
      get: {
        summary: 'Get all inventory items',
        responses: {
          200: { description: 'List of items' }
        }
      }
    },
    '/inventory/{id}': {
      get: {
        summary: 'Get item by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Item found' },
          404: { description: 'Item not found' }
        }
      },
      put: {
        summary: 'Update item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Item updated' },
          404: { description: 'Item not found' }
        }
      },
      delete: {
        summary: 'Delete item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Item deleted' },
          404: { description: 'Item not found' }
        }
      }
    },
    '/register': {
      post: {
        summary: 'Create new item',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  inventory_name: { type: 'string' },
                  description: { type: 'string' },
                  photo: { type: 'string', format: 'binary' }
                },
                required: ['inventory_name']
              }
            }
          }
        },
        responses: {
          201: { description: 'Item created' },
          400: { description: 'Name is required' }
        }
      }
    },
    '/inventory/{id}/photo': {
      get: {
        summary: 'Get item photo',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Photo file' },
          404: { description: 'Photo not found' }
        }
      },
      put: {
        summary: 'Upload/update photo',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  photo: { type: 'string', format: 'binary' }
                },
                required: ['photo']
              }
            }
          }
        },
        responses: {
          200: { description: 'Photo updated' },
          404: { description: 'Item not found' }
        }
      }
    },
    '/search': {
      post: {
        summary: 'Search items',
        requestBody: {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  has_photo: { type: 'string', enum: ['on'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Search results' },
          404: { description: 'Item not found' }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/* ===================== CRUD ===================== */

app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items');

    res.json(
      result.rows.map(item => ({
        ...item,
        photoUrl: `/inventory/${item.id}/photo`
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/inventory/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM items WHERE id = $1',
      [req.params.id]
    );

    const item = result.rows[0];

    if (!item) return res.status(404).json({ error: 'Not found' });

    res.json({
      ...item,
      photoUrl: `/inventory/${item.id}/photo`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      'INSERT INTO items(name, description, photo) VALUES($1, $2, $3) RETURNING *',
      [inventory_name, description || '', req.file ? req.file.filename : null]
    );

    const item = result.rows[0];

    res.status(201).json({
      ...item,
      photoUrl: `/inventory/${item.id}/photo`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/inventory/:id', async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await pool.query(
      'UPDATE items SET name=$1, description=$2 WHERE id=$3 RETURNING *',
      [name, description, req.params.id]
    );

    const item = result.rows[0];

    if (!item) return res.status(404).json({ error: 'Not found' });

    res.json({
      ...item,
      photoUrl: `/inventory/${item.id}/photo`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/inventory/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM items WHERE id=$1 RETURNING *',
      [req.params.id]
    );

    const item = result.rows[0];

    if (!item) return res.status(404).json({ error: 'Not found' });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===================== PHOTO ===================== */

app.get('/inventory/:id/photo', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT photo FROM items WHERE id=$1',
      [req.params.id]
    );

    const item = result.rows[0];

    if (!item || !item.photo) {
      return res.status(404).send('Not found');
    }

    const photoPath = path.join(cacheDir, item.photo);
    if (!fs.existsSync(photoPath)) {
      return res.status(404).send('Photo file not found');
    }

    res.sendFile(photoPath);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM items WHERE id=$1',
      [req.params.id]
    );

    const item = result.rows[0];

    if (!item) return res.status(404).json({ error: 'Not found' });

    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    if (item.photo) {
      const oldPath = path.join(cacheDir, item.photo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query(
      'UPDATE items SET photo=$1 WHERE id=$2',
      [req.file.filename, req.params.id]
    );

    res.json({ message: 'Photo updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===================== SEARCH ===================== */

app.post('/search', async (req, res) => {
  try {
    const { id, has_photo } = req.body;

    const result = await pool.query(
      'SELECT * FROM items WHERE id=$1',
      [id]
    );

    const item = result.rows[0];

    if (!item) return res.status(404).send('Not Found');

    let output =
      `ID: ${item.id}\nName: ${item.name}\nDescription: ${item.description}`;

    if (has_photo === 'on') {
      output += `\nPhoto URL: /inventory/${item.id}/photo`;
    }

    res.send(output);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ===================== FORMS ===================== */

app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

/* ===================== 405 ===================== */

app.use((req, res) => {
  res.status(405).send('Method Not Allowed');
});

/* ===================== START ===================== */

const PORT = Number(options.port) || 3000;
const HOST = options.host || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Cache directory: ${cacheDir}`);
  console.log(`Swagger docs: http://${HOST}:${PORT}/api-docs`);
});