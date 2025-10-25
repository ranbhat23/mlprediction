import * as tf from '@tensorflow/tfjs';

// 1. Data Structure Interface
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}

// 2. Mock Intraday Data (Replace with your actual OHLC data)
const rawData: IntradayData[] = [
    { open: 800, high: 805, low: 795, close: 803 },
    { open: 803, high: 810, low: 800, close: 808 },
    { open: 808, high: 815, low: 805, close: 812 },
    { open: 812, high: 820, low: 810, close: 818 },
    { open: 818, high: 825, low: 815, close: 822 },
    { open: 822, high: 830, low: 820, close: 827 },
    { open: 827, high: 835, low: 825, close: 832 },
    { open: 832, high: 840, low: 830, close: 838 },
    { open: 838, high: 845, low: 835, close: 842 },
    { open: 842, high: 850, low: 840, close: 848 },
    // Add more data points for better training...
];

const LOOKBACK_WINDOW = 3; // Use the last 3 data points (OHLC) to predict the next
const NUM_FEATURES = 4;    // open, high, low, close

// 3. Data Preparation for RNN (Sequential Format)
function prepareRnnData(data: IntradayData[]) {
    const inputs: number[][][] = []; // 3D array: [samples, lookback_steps, features]
    const labels: number[] = [];      // 1D array: [samples]

    // Convert OHLC objects to a 2D array of features
    const featureData = data.map(d => [d.open, d.high, d.low, d.close]);

    // Create sequences
    for (let i = 0; i <= featureData.length - LOOKBACK_WINDOW - 1; i++) {
        // X: The sequence of the last LOOKBACK_WINDOW steps (3 steps)
        const inputSequence = featureData.slice(i, i + LOOKBACK_WINDOW);
        inputs.push(inputSequence);

        // Y: The 'Close' price immediately following the sequence
        const labelPrice = featureData[i + LOOKBACK_WINDOW][NUM_FEATURES - 1]; // Close is the last feature (index 3)
        labels.push(labelPrice);
    }

    // Convert to TensorFlow Tensors
    const xs = tf.tensor3d(inputs, [inputs.length, LOOKBACK_WINDOW, NUM_FEATURES]);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    return { xs, ys };
}

// 4. Model Definition and Training
async function trainRnnModel(data: IntradayData[]) {
    const { xs, ys } = prepareRnnData(data);
    
    // Normalize data (important for LSTMs)
    // NOTE: For simplicity, normalization is skipped here, but is CRUCIAL in production.
    // Use min-max scaling on all features before training!
    
    const model = tf.sequential();

    // 5. LSTM Layer Definition
    // inputShape is [LOOKBACK_WINDOW, NUM_FEATURES] = [3, 4]
    model.add(tf.layers.lstm({
        units: 50,
        inputShape: [LOOKBACK_WINDOW, NUM_FEATURES],
        returnSequences: false // We only need the output from the last time step
    }));

    // Dropout for regularization (optional, but good practice)
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Output Layer (Predicts one value: the future Close price)
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));

    // Compile
    model.compile({
        optimizer: tf.train.adam(0.005),
        loss: 'meanSquaredError' // MSE is standard for regression tasks (price prediction)
    });

    console.log('Starting model training...');
    await model.fit(xs, ys, {
        epochs: 100, // Number of passes over the dataset
        batchSize: 4,
        verbose: 0,
        callbacks: { onEpochEnd: (epoch, logs) => {
            if (epoch % 20 === 0) console.log(`Epoch ${epoch}: Loss = ${logs?.loss.toFixed(4)}`);
        }}
    });
    console.log('Training complete.');

    xs.dispose();
    ys.dispose();
    return model;
}

// 6. Prediction Function
function predictNextClose(model: tf.Sequential, lastSequence: IntradayData[]): number {
    if (lastSequence.length !== LOOKBACK_WINDOW) {
        throw new Error(`Prediction sequence must be ${LOOKBACK_WINDOW} steps long.`);
    }

    // Convert the last sequence of OHLC to a Tensor of shape [1, 3, 4]
    const inputData = lastSequence.map(d => [d.open, d.high, d.low, d.close]);
    const inputTensor = tf.tensor3d([inputData], [1, LOOKBACK_WINDOW, NUM_FEATURES]);

    // Predict
    const predictionTensor = model.predict(inputTensor) as tf.Tensor;
    const predictedClose = predictionTensor.dataSync()[0];

    inputTensor.dispose();
    predictionTensor.dispose();

    return predictedClose;
}

// 7. Execution
async function runRnnExample() {
    if (rawData.length < LOOKBACK_WINDOW + 1) {
        console.error(`Not enough data. Need at least ${LOOKBACK_WINDOW + 1} points.`);
        return;
    }

    const model = await trainRnnModel(rawData);

    // Get the last LOOKBACK_WINDOW data points for prediction
    const predictionData = rawData.slice(-LOOKBACK_WINDOW);

    // Predict the close price for the day after the last point in rawData
    const predictedPrice = predictNextClose(model, predictionData);

    console.log('\n--- Prediction Results ---');
    console.log(`Last ${LOOKBACK_WINDOW} data points used for prediction:`);
    console.log(predictionData);
    console.log(`Predicted Close Price for the next time step: $${predictedPrice.toFixed(2)}`);

    model.dispose();
}

runRnnExample();
