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

// Directory to save edited images
const editedImagesDir = path.join('D:\\STUDIO8\\PASS_PHOTO\\galeri\\edited-images');

// Ensure the directory exists
if (!fs.existsSync(editedImagesDir)) {
    fs.mkdirSync(editedImagesDir, { recursive: true });
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

// Endpoint to handle saving edited images
app.post('/api/save-image', upload.single('file'), (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Generate the new filename with "edited" appended before the extension
    const originalName = path.parse(file.originalname);
    const newFilename = `${originalName.name}-edited${originalName.ext}`;
    const targetPath = path.join(editedImagesDir, newFilename);

    fs.rename(file.path, targetPath, (err) => {
        if (err) {
            console.error('Error saving the file:', err);
            return res.status(500).json({ success: false, message: 'Failed to save the image.' });
        }

        res.json({ success: true });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
