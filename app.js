document.addEventListener('DOMContentLoaded', () => {
  const shareArtBtn = document.getElementById('share-art-btn');
  const uploadModal = document.getElementById('upload-modal');
  const cancelBtn = document.getElementById('cancel-btn');
  const uploadForm = document.getElementById('upload-form');
  const gallery = document.getElementById('gallery');

  // State to hold approved artworks for demo purpose (should be from backend)
  let approvedArtworks = [
    { src: 'https://i.imgur.com/3Kn7HC2.png', twitter: '@monaduser1' },
    { src: 'https://i.imgur.com/EQxjvAF.png', twitter: '@monaduser2' },
    { src: 'https://i.imgur.com/IZBhGHM.png', twitter: '@monaduser3' },
    { src: 'https://i.imgur.com/IHhoeAf.png', twitter: '@monaduser4' },
  ];

  // Image compression function
  function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  // Function to render gallery from approved artworks
  function renderGallery() {
    gallery.innerHTML = '';
    approvedArtworks.forEach(({ src, twitter }) => {
      const image = document.createElement('img');
      image.src = src;
      image.alt = `Monad art by ${twitter}`;
      image.loading = 'lazy'; // Add lazy loading
      gallery.appendChild(image);

      const credit = document.createElement('div');
      credit.className = 'art-credit';
      credit.textContent = `Art by ${twitter}`;
      gallery.appendChild(credit);
    });
  }

  // Open modal
  shareArtBtn.addEventListener('click', () => {
    uploadModal.hidden = false;
    shareArtBtn.setAttribute('aria-expanded', 'true');
  });

  // Close modal
  cancelBtn.addEventListener('click', () => {
    uploadModal.hidden = true;
    shareArtBtn.setAttribute('aria-expanded', 'false');
    uploadForm.reset();
  });

  // Handle form submit
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = uploadForm.elements['image'];
    const twitterInput = uploadForm.elements['twitter'];

    if (!fileInput.files.length) {
      alert('Please select an image to upload.');
      return;
    }

    const file = fileInput.files[0];
    const twitterUser = twitterInput.value.trim();

    // File size check (1MB limit)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      alert('File size must be less than 1MB. Please choose a smaller image.');
      return;
    }

    // Basic client-side validation for Twitter username pattern
    const twitterPattern = /^@?(\w){1,15}$/;
    if (!twitterPattern.test(twitterUser)) {
      alert('Please enter a valid Twitter username, starting with @.');
      return;
    }

    try {
      // Compress image before upload
      const compressedBlob = await compressImage(file);
      console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Compressed: ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`);
      
      // For demonstration, simulate approval and add to gallery instantly
      // In real implementation, compressed image and data are sent to backend for moderation
      const reader = new FileReader();
      reader.onload = () => {
        approvedArtworks.push({ src: reader.result, twitter: twitterUser.startsWith('@') ? twitterUser : '@' + twitterUser });
        renderGallery();
        uploadModal.hidden = true;
        shareArtBtn.setAttribute('aria-expanded', 'false');
        uploadForm.reset();
        alert('Thank you for sharing your Monad art! It is now visible in the gallery.');
      };
      reader.readAsDataURL(compressedBlob);
    } catch (error) {
      console.error('Error compressing image:', error);
      alert('Error processing image. Please try again.');
    }
  });

  // Initial render
  renderGallery();
});
