const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({
    dest: 'temp/', // Temporary storage for file uploads
});

// Base directory for network folder
const baseDirectory = '\\\\192.168.1.22\\studio 2\\06082024';

// Ensure base directory exists
if (!fs.existsSync(baseDirectory)) {
    fs.mkdirSync(baseDirectory, { recursive: true });
}

// Serve static files (e.g., images) from the correct directory
app.use('/pictures', express.static(path.join('\\\\192.168.1.22\\studio 2\\FOTO BUPATI RENDRA')));

// Serve gallery HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get image files from a specified directory
app.get('/api/images', (req, res) => {
    const imagesDir = path.join('\\\\192.168.1.22\\studio 2\\FOTO BUPATI RENDRA');

    fs.readdir(imagesDir, (err, files) => {
        if (err) {
            console.error('Error reading images directory:', err);
            return res.status(500).json({ error: 'Unable to read images directory' });
        }

        const imageFiles = files.filter(file => {
            const filePath = path.join(imagesDir, file);
            const isImage = fs.statSync(filePath).isFile() && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file);
            return isImage;
        });

        res.json(imageFiles);
    });
});

// Endpoint untuk mendapatkan daftar folder
app.get('/api/folder-list', (req, res) => {
    fs.readdir(baseDirectory, (err, folders) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).json({ error: 'Unable to read directory' });
        }

        const directoryFolders = folders.filter(folder => {
            const folderPath = path.join(baseDirectory, folder);
            return fs.statSync(folderPath).isDirectory();
        });

        res.json(directoryFolders);
    });
});

app.post('/api/save-image', upload.fields([{ name: 'original' }, { name: 'edited' }]), (req, res) => {
    console.log('Request Body:', req.body);
    console.log('Request Files:', req.files);

    const originalFile = req.files['original'] ? req.files['original'][0] : null;
    const editedFile = req.files['edited'] ? req.files['edited'][0] : null;
    const folder = req.body.folder;

    if (!folder) {
        return res.status(400).json({ success: false, message: 'No folder specified.' });
    }

    if (!originalFile || !editedFile) {
        return res.status(400).json({ success: false, message: 'Both original and edited files are required.' });
    }

    // Define directories
    const pilFolder = path.join(baseDirectory, folder, 'pil');
    const fixFolder = path.join(baseDirectory, folder, 'fix');

    // Create directories if they do not exist
    if (!fs.existsSync(pilFolder)) {
        fs.mkdirSync(pilFolder, { recursive: true });
    }
    if (!fs.existsSync(fixFolder)) {
        fs.mkdirSync(fixFolder, { recursive: true });
    }

    // Function to handle file copy and cleanup
    const handleFile = (file, targetFolder, callback) => {
        const targetPath = path.join(targetFolder, file.originalname);
        fs.copyFile(file.path, targetPath, (err) => {
            if (err) {
                console.error(`Error saving file ${file.originalname}:`, err);
                return callback(err);
            }

            // Clean up temporary file
            fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting temporary file ${file.originalname}:`, err);
            });

            callback(null);
        });
    };

    // Handle saving the original file
    handleFile(originalFile, pilFolder, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to save original image.' });
        }

        // Handle saving the edited file
        handleFile(editedFile, fixFolder, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to save edited image.' });
            }

            res.json({ success: true });
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});