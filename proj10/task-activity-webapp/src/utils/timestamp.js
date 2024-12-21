exports.getCurrentTimestamp = function() {
    const now = new Date();
    return now.toISOString(); // Returns the current date and time in ISO format
};