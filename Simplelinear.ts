const MLR = require('ml-regression-multivariate-linear');

// Sample data with two independent variables (x1, x2) and one dependent variable (y)
const x = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]; // Features
const y = [5, 7, 9, 11, 13]; // Target

// Create and train the model
const regression = new MLR(x, y);

// Log the model's parameters (coefficients and intercept)
console.log('Coefficients:', regression.weights);
console.log('Intercept:', regression.bias);

// Make a prediction for new data
const newX = [6, 7];
const prediction = regression.predict(newX);
console.log('Prediction for [6, 7]:', prediction);
