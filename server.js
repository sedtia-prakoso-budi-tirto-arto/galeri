const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 3001;

const backupLog = [];

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
const mainFolder = '\\\\192.168.1.22\\studio 2\\FOTO BUPATI RENDRA';

// Ensure base directory exists
if (!fs.existsSync(baseDirectory)) {
    fs.mkdirSync(baseDirectory, { recursive: true });
}

// Serve static files (e.g., images) from the correct directory
app.use('/pictures', express.static(mainFolder));

// Serve gallery HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to handle backup
app.post('/api/backup-images', (req, res) => {
    const mainFolder = '\\\\192.168.1.22\\studio 2\\FOTO BUPATI RENDRA';
    const backupFolder = req.body.backupFolder;

    // Validate the backup folder path
    const fullBackupPath = path.join('\\\\192.168.1.22\\studio 2\\06082024', backupFolder);

    if (!fs.existsSync(fullBackupPath)) {
        return res.status(400).send('Backup folder does not exist.');
    }

    fs.readdir(mainFolder, (err, files) => {
        if (err) return res.status(500).send('Error reading main folder: ' + err.message);

        const moveLog = [];

        files.forEach(file => {
            const srcPath = path.join(mainFolder, file);
            const destPath = path.join(fullBackupPath, file);

            // Check if file exists before attempting to move it
            if (!fs.existsSync(srcPath)) {
                console.error(`Source file does not exist: ${srcPath}`);
                return;
            }

            fs.rename(srcPath, destPath, (err) => {
                if (err) {
                    console.error(`Error moving file: ${file}`, err);
                    return;
                }
                moveLog.push({ src: srcPath, dest: destPath });
                console.log(`Successfully moved file: ${file}`);
            });
        });

        backupLog.push(moveLog);

        res.json({ success: true });
    });
});

app.post('/api/undo-backup', (req, res) => {
    if (backupLog.length === 0) {
        return res.status(400).json({ error: 'No backups to undo.' });
    }

    const lastBackup = backupLog.pop();

    lastBackup.forEach(move => {
        fs.rename(move.dest, move.src, (err) => {
            if (err) {
                console.error(`Error moving file back: ${move.dest}`, err);
                return res.status(500).json({ error: 'Failed to undo backup.' });
            }
        });
    });

    res.json({ success: true });
});

// Get image files from a specified directory
app.get('/api/images', (req, res) => {
    const folder = req.query.folder || ''; // Get folder from query string
    const imagesDir = path.join(mainFolder, folder);

    console.log('Serving images from directory:', imagesDir); // Debugging

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

// Endpoint to get backup folder images
app.get('/api/backup-images', (req, res) => {
    const backupFolder = req.query.folder || '';
    const backupDir = path.join(baseDirectory, backupFolder);

    console.log('Serving backup images from directory:', backupDir); // Debugging

    fs.readdir(backupDir, (err, files) => {
        if (err) {
            console.error('Error reading backup images directory:', err);
            return res.status(500).json({ error: 'Unable to read backup images directory' });
        }

        const imageFiles = files.filter(file => {
            const filePath = path.join(backupDir, file);
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