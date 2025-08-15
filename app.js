document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const loading = document.getElementById('loading');
    const gallery = document.getElementById('gallery');
    const imageCards = document.querySelectorAll('.image-card');
    const images = document.querySelectorAll('img[loading="lazy"]');
    const shareArtBtn = document.getElementById('share-art-btn');
    const uploadModal = document.getElementById('upload-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const uploadForm = document.getElementById('upload-form');
    const galleryGrid = document.querySelector('.gallery-grid');
    const imagePreview = document.getElementById('image-preview');
    const imagePreviewImg = document.getElementById('image-preview-img');
    const successOverlay = document.getElementById('success-overlay');
    const successClose = document.getElementById('success-close');
    
    // Initialize the application
    init();
    
    function init() {
        // Show loading initially
        showLoading();
        // Setup image loading handlers
        setupImageLoading();
        // Setup intersection observer for animations
        setupScrollAnimations();
        // Setup smooth scroll behavior
        setupSmoothScroll();
        // Setup upload modal handlers
        setupUploadModal();
        // Simulate loading time and show gallery
        setTimeout(() => {
            hideLoading();
            showGallery();
            renderApprovedFromStorage();
        }, 1500);
    }
    
    function showLoading() {
        loading.classList.remove('hidden');
        gallery.classList.remove('visible');
    }
    
    function setupUploadModal() {
        if (shareArtBtn && uploadModal) {
            shareArtBtn.addEventListener('click', () => {
                uploadModal.hidden = false;
                shareArtBtn.setAttribute('aria-expanded', 'true');
            });
        }
        
        if (cancelBtn && uploadModal && uploadForm) {
            cancelBtn.addEventListener('click', () => {
                uploadModal.hidden = true;
                shareArtBtn && shareArtBtn.setAttribute('aria-expanded', 'false');
                uploadForm.reset();
                resetUploadState();
            });
        }
        
        if (uploadForm && galleryGrid) {
            // Live preview when selecting a file
            const fileInput = document.getElementById('image-upload');
            if (fileInput && imagePreview && imagePreviewImg) {
                fileInput.addEventListener('change', () => {
                    if (fileInput.files && fileInput.files[0]) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            imagePreviewImg.src = reader.result;
                            imagePreview.hidden = false;
                        };
                        reader.readAsDataURL(fileInput.files[0]);
                    } else {
                        imagePreview.hidden = true;
                        imagePreviewImg.removeAttribute('src');
                    }
                });
            }
            
            // Prevent multiple submissions
            let isUploading = false;
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                document.activeElement.blur();
                
                // Prevent multiple submissions
                if (isUploading) {
                    console.log('Upload already in progress, ignoring click');
                    return;
                }
                
                const fileInput = uploadForm.elements['image'];
                const twitterInput = uploadForm.elements['twitter'];
                
                if (!fileInput || !fileInput.files || !fileInput.files.length) {
                    showMessage('Please select an image to upload.', 'error');
                    return;
                }
                
                const file = fileInput.files[0];
                const twitterUserRaw = (twitterInput && twitterInput.value ? twitterInput.value : '').trim();
                
                // Fixed regex pattern - removed incorrect escaping
                const twitterPattern = /^@?(\w){1,15}$/;
                if (!twitterPattern.test(twitterUserRaw)) {
                    showMessage('Please enter a valid Twitter username, starting with @.', 'error');
                    return;
                }
                
                const twitterUser = twitterUserRaw.startsWith('@') ? twitterUserRaw : `@${twitterUserRaw}`;
                
                try {
                    // Set uploading state
                    isUploading = true;
                    setUploadButtonState(true, 'Uploading...');
                    
                    const reader = new FileReader();
                    reader.onload = async () => {
                        // If Edge Function is configured, send directly; otherwise fallback to local storage
                        const cfg = window.MonadgramConfig || {};
                        const uploadUrl = cfg.EDGE?.UPLOAD_URL;
                        
                        if (uploadUrl) {
                            try {
                                const res = await fetch(uploadUrl, {
                                    method: 'POST',
                                    headers: {
                                        'content-type': 'application/json',
                                        // Include Supabase auth so function works even if Verify JWT is enabled
                                        ...(cfg.SUPABASE_ANON_KEY ? { 'apikey': cfg.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}` } : {}),
                                    },
                                    body: JSON.stringify({ dataUrl: reader.result, fileName: file.name, twitter: twitterUser })
                                });
                                
                                if (!res.ok) throw new Error('Upload failed');
                                
                                // Show success message
                                showMessage('Thank you for sharing your Monad art! It has been submitted for approval.', 'success');
                            } catch (e) {
                                console.error('Remote upload failed, falling back to local:', e);
                                showMessage('Upload failed, but saved locally. Please try again later.', 'error');
                                const submission = { id: `sub_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, src: reader.result, twitter: twitterUser, createdAt: Date.now() };
                                const pending = getPendingSubmissions();
                                pending.push(submission);
                                setPendingSubmissions(pending);
                            }
                        } else {
                            const submission = { id: `sub_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, src: reader.result, twitter: twitterUser, createdAt: Date.now() };
                            const pending = getPendingSubmissions();
                            pending.push(submission);
                            setPendingSubmissions(pending);
                            
                            // Show success message
                            showMessage('Thank you for sharing your Monad art! It has been saved locally.', 'success');
                        }
                        
                        // Close modal and reset form
                        uploadModal.hidden = true;
                        shareArtBtn && shareArtBtn.setAttribute('aria-expanded', 'false');
                        uploadForm.reset();
                        if (imagePreview) {
                            imagePreview.hidden = true;
                            imagePreviewImg.removeAttribute('src');
                        }
                        
                        // Reset upload state
                        isUploading = false;
                        setUploadButtonState(false, 'Upload');
                        showSuccessOverlay();
                    };
                    
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('Error processing upload:', error);
                    showMessage('Error processing upload. Please try again.', 'error');
                    isUploading = false;
                    setUploadButtonState(false, 'Upload');
                }
            });
        }
    }
    
    // Helper functions for better UX
    function setUploadButtonState(isLoading, text) {
        const uploadBtn = document.querySelector('#upload-form button[type="submit"]');
        if (uploadBtn) {
            uploadBtn.disabled = isLoading;
            uploadBtn.textContent = text;
            if (isLoading) {
                uploadBtn.classList.add('uploading');
            } else {
                uploadBtn.classList.remove('uploading');
            }
        }
    }
    
    function resetUploadState() {
        setUploadButtonState(false, 'Upload');
        if (imagePreview) {
            imagePreview.hidden = true;
        }
    }
    
    function showMessage(message, type = 'info') {
        // Create or update message element
        let messageEl = document.getElementById('upload-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'upload-message';
            messageEl.className = 'upload-message';
            uploadForm.appendChild(messageEl);
        }
        
        messageEl.textContent = message;
        messageEl.className = `upload-message ${type}`;
        messageEl.hidden = false;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageEl.hidden = true;
        }, 5000);
    }
    
    function showSuccessOverlay() {
        if (!successOverlay) return;
        
        successOverlay.hidden = false;
        const onClose = () => {
            successOverlay.hidden = true;
            successClose && successClose.removeEventListener('click', onClose);
        };
        
        successClose && successClose.addEventListener('click', onClose);
        setTimeout(onClose, 3200);
    }
    
    // Local storage helpers and gallery renderer for admin workflow
    const PENDING_KEY = 'monadgram_pending';
    const APPROVED_KEY = 'monadgram_approved';
    
    function getPendingSubmissions() {
        try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
    }
    
    function setPendingSubmissions(items) {
        localStorage.setItem(PENDING_KEY, JSON.stringify(items));
    }
    
    function getApprovedSubmissions() {
        try { return JSON.parse(localStorage.getItem(APPROVED_KEY) || '[]'); } catch { return []; }
    }
    
    function setApprovedSubmissions(items) {
        localStorage.setItem(APPROVED_KEY, JSON.stringify(items));
    }
    
    function renderApprovedFromStorage() {
        const approved = getApprovedSubmissions();
        if (approved.length > 0) {
            approved.forEach(item => {
                addImageToGallery(item.src, item.twitter);
            });
        }
    }
    
    function addImageToGallery(src, twitter) {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.innerHTML = `
            <div class="image-container">
                <img src="${src}" alt="Monad art by ${twitter}" loading="lazy">
                <div class="image-overlay">
                    <div class="image-title">Monad Art</div>
                    <div class="image-credit">by ${twitter}</div>
                </div>
            </div>
        `;
        galleryGrid.appendChild(imageCard);
    }
    
    function setupImageLoading() {
        images.forEach(img => {
            img.addEventListener('load', () => {
                img.classList.add('loaded');
            });
        });
    }
    
    function setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                }
            });
        }, observerOptions);
        
        imageCards.forEach(card => {
            observer.observe(card);
        });
    }
    
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
    
    function hideLoading() {
        loading.classList.add('hidden');
    }
    
    function showGallery() {
        gallery.classList.add('visible');
    }
    
    // Admin panel functionality
    function openAdminPanel() {
        window.open('/admin', '_blank');
    }
    
    // Check if user is admin (you can implement your own logic)
    function isAdmin() {
        // For demo purposes, always return true
        // In production, implement proper authentication
        return true;
    }
    
    // Add admin button if user is admin
    if (isAdmin()) {
        const adminBtn = document.createElement('button');
        adminBtn.textContent = 'Admin Panel';
        adminBtn.className = 'btn btn--primary';
        adminBtn.style.position = 'fixed';
        adminBtn.style.top = '20px';
        adminBtn.style.right = '20px';
        adminBtn.style.zIndex = '1000';
        adminBtn.addEventListener('click', openAdminPanel);
        document.body.appendChild(adminBtn);
    }
    
    // Handle window resize for responsive design
    window.addEventListener('resize', () => {
        // Add any responsive logic here
    });
    
    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden, pause any animations or timers
        } else {
            // Page is visible again, resume animations
        }
    });
    
    // Error handling for failed image loads
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG') {
            console.error('Failed to load image:', e.target.src);
            e.target.style.display = 'none';
        }
    }, true);
    
    // Keyboard navigation support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !uploadModal.hidden) {
            uploadModal.hidden = true;
            shareArtBtn && shareArtBtn.setAttribute('aria-expanded', 'false');
            uploadForm.reset();
            resetUploadState();
        }
    });
    
    // Touch gesture support for mobile
    let touchStartY = 0;
    let touchEndY = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    });
    
    document.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches.screenY;
        handleSwipeGesture();
    });
    
    function handleSwipeGesture() {
        const swipeThreshold = 50;
        const diff = touchStartY - touchEndY;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe up
                console.log('Swipe up detected');
            } else {
                // Swipe down
                console.log('Swipe down detected');
            }
        }
    }
    
    // Performance optimization: Debounce scroll events
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
            // Handle scroll-based animations or effects
        }, 16); // ~60fps
    });
    
    // Accessibility improvements
    function setupAccessibility() {
        // Add ARIA labels to interactive elements
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (!button.getAttribute('aria-label')) {
                button.setAttribute('aria-label', button.textContent);
            }
        });
        
        // Add focus indicators
        const focusableElements = document.querySelectorAll('button, input, a, [tabindex]');
        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.style.outline = '2px solid #8b5cf6';
                element.style.outlineOffset = '2px';
            });
            element.addEventListener('blur', () => {
                element.style.outline = '';
                element.style.outlineOffset = '';
            });
        });
    }
    
    // Initialize accessibility features
    setupAccessibility();
    
    // Service Worker registration for PWA capabilities
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
    
    // Analytics and performance monitoring
    function trackEvent(eventName, properties = {}) {
        // Implement your analytics tracking here
        console.log('Event tracked:', eventName, properties);
    }
    
    // Track page load performance
    window.addEventListener('load', () => {
        if ('performance' in window) {
            const perfData = performance.getEntriesByType('navigation')[0];
            trackEvent('page_load', {
                loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart
            });
        }
    });
    
    // Handle offline/online status
    window.addEventListener('online', () => {
        console.log('Application is online');
        trackEvent('app_online');
    });
    
    window.addEventListener('offline', () => {
        console.log('Application is offline');
        trackEvent('app_offline');
    });
    
    // Cleanup function for memory management
    function cleanup() {
        // Remove event listeners and clear timeouts
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Export functions for external use (if needed)
    window.MonadgramApp = {
        openAdminPanel,
        isAdmin,
        trackEvent,
        cleanup
    };
});

