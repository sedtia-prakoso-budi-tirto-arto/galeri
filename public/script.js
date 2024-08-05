let cropper;
let currentImageName = '';

document.addEventListener("DOMContentLoaded", () => {
    const gallery = document.getElementById("gallery");

    fetch('/api/images')
        .then(response => response.json())
        .then(images => {
            console.log('Data gambar yang diterima:', images);
            gallery.innerHTML = ''; // Clear the gallery before adding new photos
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
});

function showPhoto(image) {
    const photoUrl = `/pictures/${image}`;
    const photoElement = document.getElementById('photoToEdit');
    photoElement.src = photoUrl;
    currentImageName = image; // Store the name of the current image

    $('#editPhotoModal').modal('show');

    $('#editPhotoModal').on('shown.bs.modal', () => {
        if (cropper) {
            cropper.destroy();
        }
        cropper = new Cropper(photoElement, {
            aspectRatio: 1, // Default aspect ratio
            viewMode: 1,
            responsive: true,
            autoCropArea: 1
        });
    });

    $('#editPhotoModal').on('hidden.bs.modal', () => {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        photoElement.src = ''; // Clear image source
    });
}

function setCropAspectRatio(aspectRatio) {
    if (cropper) {
        cropper.setAspectRatio(aspectRatio);
        Swal.fire('Aspect Ratio Changed', `Aspect ratio set to ${aspectRatio}:1`, 'info');
    } else {
        Swal.fire('Error', 'No image is being edited.', 'error');
    }
}

function rotatePhoto() {
    if (cropper) {
        cropper.rotate(45); // Rotate by 45 degrees
    }
}

function zoomIn() {
    if (cropper) {
        cropper.zoom(0.1); // Zoom in
    }
}

function zoomOut() {
    if (cropper) {
        cropper.zoom(-0.1); // Zoom out
    }
}

function removeBackground() {
    if (cropper) {
        cropper.getCroppedCanvas().toBlob(blob => {
            const formData = new FormData();
            formData.append('image_file', blob);
            formData.append('size', 'auto'); // Adjust size if needed

            fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: {
                    'X-Api-Key': 'okBcBLh2hFSRM1zyhGWQ57tK'
                },
                body: formData
            })
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                document.getElementById('photoToEdit').src = url;
                cropper.replace(url); // Replace with new image URL
                Swal.fire('Success', 'Background removed!', 'success');
            })
            .catch(error => {
                console.error('Error removing background:', error);
                Swal.fire('Error', 'There was a problem removing the background.', 'error');
            });
        }, 'image/png'); // Use PNG to avoid compression
    }
}

function changeBackgroundColor() {
    const color = document.getElementById('bgColorPicker').value;
    if (cropper) {
        cropper.getCroppedCanvas().toBlob(blob => {
            const formData = new FormData();
            formData.append('image_file', blob);
            formData.append('size', 'auto'); // Adjust size if needed

            fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: {
                    'X-Api-Key': 'okBcBLh2hFSRM1zyhGWQ57tK'
                },
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

                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(newBlob => {
                        const newUrl = URL.createObjectURL(newBlob);
                        document.getElementById('photoToEdit').src = newUrl;
                        cropper.replace(newUrl); // Replace with new image URL
                        Swal.fire('Success', 'Background color changed!', 'success');
                    }, 'image/png', 1); // Use PNG with quality factor 1
                };
            })
            .catch(error => {
                console.error('Error changing background color:', error);
                Swal.fire('Error', 'There was a problem changing the background color.', 'error');
            });
        }, 'image/png', 1); // Use PNG with quality factor 1
    }
}

function savePhoto() {
    if (cropper) {
        cropper.getCroppedCanvas().toBlob(blob => {
            const originalName = currentImageName.split('.').slice(0, -1).join('.'); // Extract the base name without extension
            const extension = currentImageName.split('.').pop(); // Extract the file extension
            
            // Format the new filename
            const newFilename = `${originalName}.${extension}`;

            const formData = new FormData();
            formData.append('file', blob, newFilename);

            fetch('/api/save-image', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire('Success', 'Image saved successfully!', 'success');
                    $('#editPhotoModal').modal('hide'); // Hide modal after saving
                } else {
                    Swal.fire('Error', 'Failed to save the image.', 'error');
                }
            })
            .catch(error => {
                console.error('Error saving image:', error);
                Swal.fire('Error', 'There was a problem saving the image.', 'error');
            });
        }, 'image/png', 1); // Use PNG with quality factor 1
    }
}