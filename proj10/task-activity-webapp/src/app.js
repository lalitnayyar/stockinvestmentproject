const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const taskRoutes = require('./routes/taskRoutes');
const sqlite3 = require('sqlite3').verbose();
const TaskModel = require('./models/taskModel');
const TaskController = require('./controllers/taskController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const db = new sqlite3.Database('./database/tasks.db', (err) => {
    if (err) {
        console.error('Error connecting to the database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Initialize TaskController
const taskModel = new TaskModel(db);
const taskController = new TaskController(taskModel);

// Routes
app.use('/', taskRoutes(db));

// Home route
app.get('/', async (req, res) => {
    try {
        const tasks = await taskModel.getTasks();
        res.render('index', { tasks });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});