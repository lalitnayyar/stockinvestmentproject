const express = require('express');
const TaskController = require('../controllers/taskController');
const TaskModel = require('../models/taskModel');

module.exports = (db) => {
    const router = express.Router();
    const taskModel = new TaskModel(db);
    const taskController = new TaskController(taskModel);

    router.post('/tasks', taskController.createTask.bind(taskController));
    router.get('/tasks', taskController.getTasks.bind(taskController));
    router.get('/tasks/print', taskController.printTasks.bind(taskController));

    return router;
};