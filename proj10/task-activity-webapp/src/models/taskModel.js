class TaskModel {
    constructor(db) {
        this.db = db;
    }

    createTask(name, description, timestamp) {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO tasks (name, description, timestamp) VALUES (?, ?, ?)`;
            this.db.run(query, [name, description, timestamp], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    getTasks() {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM tasks`;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = TaskModel;