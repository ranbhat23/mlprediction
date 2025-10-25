import * as tf from '@tensorflow/tfjs-node'; // Using -node for performance

// --- Data & Min/Max (Assuming this data is already sorted by date, oldest first) ---
const stockData = [
    { date: "2024-01-01", open: 765.00, high: 775.00, low: 760.00, close: 770.00 },
    { date: "2024-01-02", open: 771.00, high: 780.00, low: 768.00, close: 778.00 },
    // ... (Your 17 more data points go here) ...
    { date: "2024-01-19", open: 805.00, high: 815.00, low: 795.00, close: 809.00 },
    { date: "2024-01-22", open: 811.25, high: 826.50, low: 731.95, close: 823.00 } // Prediction Day
];

// Determine min/max across all relevant price data for scaling
const ALL_PRICES = stockData.flatMap(d => [d.open, d.high, d.low, d.close]);
const MIN_PRICE = Math.min(...ALL_PRICES);
const MAX_PRICE = Math.max(...ALL_PRICES);

// --- 1. Scaling Helper Functions ---

// Scale price to [0, 1] range
function scale(price) {
    if (MAX_PRICE === MIN_PRICE) return 0.5; // Avoid division by zero
    return (price - MIN_PRICE) / (MAX_PRICE - MIN_PRICE);
}

// Denormalize scaled prediction back to price
function denormalize(scaledPrice) {
    return scaledPrice * (MAX_PRICE - MIN_PRICE) + MIN_PRICE;
}

// --- 2. Data Preparation Function (UPDATED) ---

function prepareLaggedData(data) {
    const inputs = [];
    const labels = [];
    
    // We start from the second element (i=1) to use the previous day's data (i-1) as features
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // FEATURE ENGINEERING: Calculate Pivot Point (PP) from yesterday's data
        const yesterdayPP = (yesterday.high + yesterday.low + yesterday.close) / 3;

        // X (Input Features) - 5 features now: Open, H(t-1), L(t-1), C(t-1), PP(t-1)
        const features = [
            scale(today.open),
            scale(yesterday.high),
            scale(yesterday.low),
            scale(yesterday.close),
            scale(yesterdayPP) // 5th feature: Scaled Pivot Point
        ];
        inputs.push(features);

        // Y (Label/Target) - Today's Close
        labels.push([scale(today.close)]);
    }

    // Convert data arrays to TensorFlow Tensors
    const inputTensor = tf.tensor2d(inputs);
    const labelTensor = tf.tensor22(labels);

    return { inputTensor, labelTensor };
}

// --- 3. Model Definition and Training (UPDATED INPUT SHAPE) ---

function createModel() {
    const model = tf.sequential();
    
    // Input shape is now 5: [Open, H(t-1), L(t-1), C(t-1), PP(t-1)]
    model.add(tf.layers.dense({ 
        units: 1, 
        inputShape: [5] // <--- UPDATED: Changed from [4] to [5]
    }));
    
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
    });

    return model;
}

// --- 4. Main Execution Strategy (Prediction Logic remains the same) ---

async function runStrategy() {
    // 1. Prepare Data
    // Slice off the last day, as its 'close' is the value we want to predict
    const trainingData = stockData.slice(0, stockData.length - 1);
    const { inputTensor, labelTensor } = prepareLaggedData(trainingData);

    // 2. Create Model
    const model = createModel();

    // 3. Train Model
    console.log("Starting model training...");
    await model.fit(inputTensor, labelTensor, {
        epochs: 500, // Increased epochs for better convergence with -node
        verbose: 0
    });
    console.log("Training complete.");

    // 4. Prepare NEW Input for Prediction
    const lastDataPoint = stockData[stockData.length - 2];
    const newDay = stockData[stockData.length - 1];

    // Calculate Pivot Point for the last known day
    const lastDayPP = (lastDataPoint.high + lastDataPoint.low + lastDataPoint.close) / 3;

    // Create the 5-feature input tensor for the prediction day
    const newFeatures = [
        scale(newDay.open), // Current Day's Open
        scale(lastDataPoint.high),
        scale(lastDataPoint.low),
        scale(lastDataPoint.close),
        scale(lastDayPP) // The new 5th feature
    ];

    // Use tf.tidy to wrap the prediction logic, ensuring all intermediate tensors are disposed
    const predictedClose = tf.tidy(() => {
        const predictionTensor = tf.tensor2d([newFeatures]);
        const predictionScaled = model.predict(predictionTensor);
        
        // Denormalize the single prediction value
        return denormalize(predictionScaled.dataSync()[0]);
    });
    
    // 5. Output Results
    console.log(`\n--- Scaling Parameters ---`);
    console.log(`Min Price: ${MIN_PRICE.toFixed(2)}, Max Price: ${MAX_PRICE.toFixed(2)}`);
    
    console.log(`\n--- Strategy Output ---`);
    console.log(`Current Open Price: $${newDay.open.toFixed(2)}`);
    console.log(`Predicted Close Price: $${predictedClose.toFixed(2)}`);
    
    // 6. Performance Check and Cleanup (using the actual close price)
    console.log(`\n--- Performance Check ---`);
    const deviation = predictedClose - newDay.close;
    console.log(`Actual Close: $${newDay.close.toFixed(2)}`);
    console.log(`Deviation: $${deviation.toFixed(2)}`);
    
    // Cleanup: Dispose of the model and training tensors
    model.dispose();
    inputTensor.dispose();
    labelTensor.dispose();
    console.log(`\nTrained model and all tensors disposed.`);
}

// Execute the strategy
runStrategy();
