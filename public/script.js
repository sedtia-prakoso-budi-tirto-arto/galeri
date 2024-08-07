let cropper;
let currentImageName = '';
let currentAngle = 0;
let rotateControl, photoElement, isRotating = false, startAngle;
const rotationSensitivity = 0.5;
const maxDegrees = 360;
let isBackupMode = false;
let undoStack = [];
let editedImageDataUrl = '';

// Definisikan loadGallery di sini agar bisa diakses secara global
function loadGallery() {
    const gallery = document.getElementById("gallery");
    const endpoint = isBackupMode ? '/api/backup-images' : '/api/images';
    fetch(endpoint)
        .then(response => response.json())
        .then(images => {
            gallery.innerHTML = '';
            if (Array.isArray(images)) {
                images.forEach(image => {
                    const photoDiv = document.createElement("div");
                    photoDiv.className = "p-2";
                    photoDiv.innerHTML = `
                        <img src="/pictures/${image}" class="img-thumbnail" alt="${image}" onclick="showPhoto('${image}')">
                    `;
                    gallery.appendChild(photoDiv);
                });
            } else {
                console.error('Data gambar bukan array:', images);
            }
        })
        .catch(error => console.error('Error fetching images:', error));
}

document.addEventListener("DOMContentLoaded", () => {
    const gallery = document.getElementById("gallery");
    const folderSelect = document.getElementById('folderSelect');
    const backupBtn = document.getElementById('backupBtn');
    const backBtn = document.getElementById('backBtn');

    fetch('/api/folder-list')
        .then(response => response.json())
        .then(folders => {
            folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                folderSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching folder list:', error);
        });

    async function loadBackupGallery(folder) {
        try {
            const response = await fetch(`/api/backup-images?folder=${folder}`);
            if (!response.ok) throw new Error('Failed to load images');

            const images = await response.json();
            gallery.innerHTML = '';
            images.forEach(image => {
                const imgElement = document.createElement('img');
                imgElement.src = `http://localhost:3001/pictures/${image}`;
                imgElement.alt = image;
                gallery.appendChild(imgElement);
            });
        } catch (error) {
            console.error('Error fetching images:', error);
        }
    }

    loadGallery();

    backupBtn.addEventListener('click', () => {
        const today = new Date();
        const folderName = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getFullYear()}`;
        
        fetch('/api/backup-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ backupFolder: folderName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                Swal.fire('Success', 'Backup completed successfully!', 'success');
                isBackupMode = true;
                backBtn.style.display = 'block';
                backupBtn.style.display = 'none';
                loadBackupGallery(folderName);
            } else {
                Swal.fire('Error', 'Failed to complete backup.', 'error');
            }
        })
        .catch(error => {
            console.error('Error during backup:', error);
            Swal.fire('Error', 'There was a problem with the backup process.', 'error');
        });
    });

    backBtn.addEventListener('click', () => {
        isBackupMode = false;
        loadGallery();
        backBtn.style.display = 'none';
        backupBtn.style.display = 'block';
    });
});

function showPhoto(image) {
    const photoUrl = `/pictures/${image}`;
    photoElement = document.getElementById('photoToEdit');
    photoElement.src = photoUrl;
    currentImageName = image;

    $('#editPhotoModal').modal('show');

    $('#editPhotoModal').on('shown.bs.modal', () => {
        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(photoElement, {
            aspectRatio: 2 / 3,
            viewMode: 1,
            responsive: true,
            autoCropArea: 1,
            movable: true,
            zoomable: true,
            rotatable: true,
            cropBoxResizable: false,
            cropBoxMovable: false,
            guides: false,
            highlight: false,
            dragMode: 'move'
        });

        rotateControl = document.getElementById('rotateControl');
        if (rotateControl) {
            rotateControl.addEventListener('mousedown', startRotate);
            document.addEventListener('mousemove', rotateImage);
            document.addEventListener('mouseup', endRotate);
        } else {
            console.error('Rotate control not found');
        }

        const hammer = new Hammer(photoElement);
        hammer.get('pinch').set({ enable: true });
        hammer.get('rotate').set({ enable: true });
        
        hammer.on('pinchmove', (ev) => {
            if (cropper) {
                cropper.zoom(ev.scale - 1);
            }
        });

        hammer.on('rotatemove', (ev) => {
            if (cropper) {
                cropper.rotate(ev.rotation * rotationSensitivity);
                currentAngle += ev.rotation * rotationSensitivity;
                currentAngle = normalizeAngle(currentAngle);
            }
        });

        undoStack = [];
        saveStateForUndo();
    });

    $('#editPhotoModal').on('hidden.bs.modal', () => {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        photoElement.src = '';
        document.removeEventListener('mousemove', rotateImage);
        document.removeEventListener('mouseup', endRotate);
    });
}

function startRotate(e) {
    isRotating = true;
    if (rotateControl) {
        const rect = rotateControl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    } else {
        console.error('Rotate control is not defined');
    }
}

function rotateImage(e) {
    if (isRotating && rotateControl) {
        const rect = rotateControl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentAngleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const angleDiff = (currentAngleRad - startAngle) * (180 / Math.PI);

        currentAngle += angleDiff * rotationSensitivity;
        currentAngle = normalizeAngle(currentAngle);
        startAngle = currentAngleRad;

        if (cropper) {
            cropper.rotate(angleDiff * rotationSensitivity);
        }
        rotateControl.style.transform = `rotate(${currentAngle}deg)`;
    }
}

function endRotate() {
    isRotating = false;
}

function normalizeAngle(angle) {
    return (angle % maxDegrees + maxDegrees) % maxDegrees;
}

function saveStateForUndo() {
    if (cropper && cropper.getCroppedCanvas()) {
        cropper.getCroppedCanvas().toBlob(blob => {
            undoStack.push(URL.createObjectURL(blob));
        });
    } else {
        console.error('Cropper atau canvas tidak tersedia untuk menyimpan state.');
    }
}

document.getElementById('undoEditBtn').addEventListener('click', () => {
    if (undoStack.length > 1) {
        undoStack.pop(); // Hapus state terbaru
        const previousStateUrl = undoStack[undoStack.length - 1];

        if (cropper) {
            cropper.destroy();
        }
        photoElement.src = previousStateUrl;
        cropper = new Cropper(photoElement, {
            aspectRatio: 2 / 3,
            viewMode: 1,
            responsive: true,
            autoCropArea: 1,
            movable: true,
            zoomable: true,
            rotatable: true,
            cropBoxResizable: false,
            cropBoxMovable: false,
            guides: false,
            highlight: false,
            dragMode: 'move'
        });
    } else {
        Swal.fire('Info', 'Tidak ada perubahan untuk di-undo.', 'info');
    }
});

document.getElementById('undoBackupBtn').addEventListener('click', () => {
    fetch('/api/undo-backup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire('Success', 'Backup undo completed successfully!', 'success');
            loadGallery(); // Memanggil loadGallery secara global
        } else {
            Swal.fire('Error', 'Failed to undo backup.', 'error');
        }
    })
    .catch(error => {
        console.error('Error during undo backup:', error);
        Swal.fire('Error', 'There was a problem with the undo backup process.', 'error');
    });
});

function rotatePhoto() {
    if (cropper) {
        saveStateForUndo();
        cropper.rotate(90);
    }
}

function zoomIn() {
    if (cropper) {
        saveStateForUndo();
        cropper.zoom(0.1);
    }
}

function zoomOut() {
    if (cropper) {
        saveStateForUndo();
        cropper.zoom(-0.1);
    }
}

function setCropAspectRatio(aspectRatio) {
    if (cropper) {
        cropper.setAspectRatio(aspectRatio);
        Swal.fire('Aspect Ratio Changed', `Aspect ratio set to ${aspectRatio}:1`, 'info');
    } else {
        Swal.fire('Error', 'No image is being edited.', 'error');
    }
}

function removeBackground() {
    if (cropper) {
        cropper.getCroppedCanvas().toBlob(blob => {
            const formData = new FormData();
            formData.append('file', blob);

            fetch('http://192.168.1.104:5000/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                document.getElementById('photoToEdit').src = url;
                cropper.replace(url);
                Swal.fire('Success', 'Background removed!', 'success');
            })
            .catch(error => {
                console.error('Error removing background:', error);
                Swal.fire('Error', 'There was a problem removing the background.', 'error');
            });
        }, 'image/png');
    }
}

function changeBackgroundColor() {
    if (cropper) {
        cropper.getCroppedCanvas().toBlob(blob => {
            const formData = new FormData();
            formData.append('file', blob);

            fetch('http://192.168.1.104:5000/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const img = new Image();
                img.src = url;
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const color = document.getElementById('bgColorPicker').value;
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(newBlob => {
                        const newUrl = URL.createObjectURL(newBlob);
                        document.getElementById('photoToEdit').src = newUrl;
                        cropper.replace(newUrl);
                        Swal.fire('Success', 'Background color changed!', 'success');
                    }, 'image/png', 1);
                };
            })
            .catch(error => {
                console.error('Error changing background color:', error);
                Swal.fire('Error', 'There was a problem changing the background color.', 'error');
            });
        }, 'image/png', 1);
    }
}

function savePhoto() {
    if (cropper) {
        const formData = new FormData();
        const originalFilename = currentImageName;
        const editedFilename = 'edited_' + originalFilename;

        const folderSelect = document.getElementById('folderSelect');
        const selectedFolder = folderSelect.value;

        if (!selectedFolder) {
            Swal.fire('Error', 'Please select a folder.', 'error');
            return;
        }

        formData.append('folder', selectedFolder);

        fetch(`/pictures/${originalFilename}`)
            .then(response => response.blob())
            .then(originalBlob => {
                formData.append('original', originalBlob, originalFilename);

                cropper.getCroppedCanvas().toBlob(blob => {
                    formData.append('edited', blob, editedFilename);

                    fetch('/api/save-image', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire('Success', 'Image saved successfully!', 'success');
                            $('#editPhotoModal').modal('hide');
                        } else {
                            Swal.fire('Error', 'Failed to save the image.', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error saving image:', error);
                        Swal.fire('Error', 'There was a problem saving the image.', 'error');
                    });
                }, 'image/png', 1);
            })
            .catch(error => {
                console.error('Error fetching original image:', error);
                Swal.fire('Error', 'There was a problem fetching the original image.', 'error');
            });
    }
}

function showLayout() {
    if (cropper) {
        // Mengambil cropped image data URL
        cropper.getCroppedCanvas().toDataURL('image/png', (dataUrl) => {
            // Membuat elemen gambar
            const imageElements = [];
            for (let i = 0; i < 9; i++) { // 3x3 layout
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.width = '33%'; // Membagi ruang layout
                img.style.padding = '1px'; // Sedikit jarak antar gambar
                img.style.boxSizing = 'border-box';
                imageElements.push(img);
            }

            const layoutPreview = document.getElementById('layoutPreview');
            layoutPreview.innerHTML = ''; // Kosongkan konten sebelumnya
            imageElements.forEach(img => layoutPreview.appendChild(img));

            $('#layoutPreviewModal').modal('show');
        });
    } else {
        Swal.fire('Error', 'No image is being edited.', 'error');
    }
}


document.getElementById('showLayoutBtn').addEventListener('click', () => {
    const layoutPreview = document.getElementById('layoutPreview');
    const image = cropper.getCroppedCanvas().toDataURL(); // Dapatkan gambar yang telah dipotong

    // Buat 9 thumbnail dengan gambar yang sama
    layoutPreview.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const img = document.createElement('img');
        img.src = image;
        img.className = 'img-thumbnail';
        img.style.width = '30%'; // Atur ukuran thumbnail
        img.style.margin = '1%'; // Atur jarak antar thumbnail
        layoutPreview.appendChild(img);
    }

    $('#layoutPreviewModal').modal('show');
});
