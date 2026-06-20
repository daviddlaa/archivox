var excelController = require('./src/controllers/excel.controller');

// Create mock request with session
var mockReq = {
    session: {
        usuario: { id: 1 }
    },
    query: {
        limite: 50,
        offset: 0
    }
};

// Create mock response
var mockRes = {
    status: function(code) {
        this.statusCode = code;
        return this;
    },
    json: function(data) {
        console.log('Response:', JSON.stringify(data, null, 2));
    }
};

// Call the controller function directly
excelController.getTodasGestiones(mockReq, mockRes);
