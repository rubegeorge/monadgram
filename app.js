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

            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const fileInput = uploadForm.elements['image'];
                const twitterInput = uploadForm.elements['twitter'];

                if (!fileInput || !fileInput.files || !fileInput.files.length) {
                    alert('Please select an image to upload.');
                    return;
                }

                const file = fileInput.files[0];
                const twitterUserRaw = (twitterInput && twitterInput.value ? twitterInput.value : '').trim();
                // Fixed regex pattern - removed incorrect escaping
                const twitterPattern = /^@?(\w){1,15}$/;
                if (!twitterPattern.test(twitterUserRaw)) {
                    alert('Please enter a valid Twitter username, starting with @.');
                    return;
                }

                const twitterUser = twitterUserRaw.startsWith('@') ? twitterUserRaw : `@${twitterUserRaw}`;

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
                        } catch (e) {
                            console.error('Remote upload failed, falling back to local:', e);
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
                    }

                    // Close modal and reset form
                    uploadModal.hidden = true;
                    shareArtBtn && shareArtBtn.setAttribute('aria-expanded', 'false');
                    uploadForm.reset();
                    if (imagePreview) {
                        imagePreview.hidden = true;
                        imagePreviewImg.removeAttribute('src');
                    }
                    showSuccessOverlay();
                };
                reader.readAsDataURL(file);
            });
        }
    }

    // (Removed toast helpers)

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
    // (Removed confetti logic)

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

    async function renderApprovedFromStorage() {
        if (!galleryGrid) return;
        const cfg = window.MonadgramConfig || {};
        const listApprovedUrl = cfg.EDGE?.LIST_APPROVED_URL;
        if (listApprovedUrl) {
            try {
                console.log('Fetching approved list from', listApprovedUrl);
                const res = await fetch(listApprovedUrl);
                if (res.ok) {
                    const { items } = await res.json();
                    console.log('Approved items fetched:', Array.isArray(items) ? items.length : 0);
                    items.forEach(({ storage_path, twitter }) => {
                        const card = document.createElement('div');
                        card.className = 'image-card';
                        const container = document.createElement('div');
                        container.className = 'image-container';
                        const img = document.createElement('img');
                        const srcUrl = cfg.buildPublicUrl ? cfg.buildPublicUrl(storage_path) : storage_path;
                        img.src = srcUrl;
                        img.alt = `Monad art by ${twitter}`;
                        img.loading = 'lazy';
                        const overlay = document.createElement('div');
                        overlay.className = 'image-overlay';
                        const title = document.createElement('span');
                        title.className = 'image-title';
                        title.textContent = `Art by ${twitter}`;
                        overlay.appendChild(title);
                        container.appendChild(img);
                        container.appendChild(overlay);
                        card.appendChild(container);
                        galleryGrid.prepend(card);
                        requestAnimationFrame(() => {
                            card.style.animationPlayState = 'running';
                            card.classList.add('animate-in');
                        });
                    });
                    return;
                } else {
                    console.warn('list-approved failed with status', res.status);
                }
            } catch (e) {
                console.warn('Remote approved fetch failed, falling back to local storage:', e);
            }
        }
        // Fallback to REST or local approved cache
        if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
            try {
                const restUrl = `${cfg.SUPABASE_URL}/rest/v1/submissions?select=storage_path,twitter,created_at&status=eq.approved&order=created_at.desc`;
                console.log('Fallback fetching REST approved list from', restUrl);
                const res = await fetch(restUrl, { headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}` } });
                if (res.ok) {
                    const items = await res.json();
                    items.forEach(({ storage_path, twitter }) => {
                        const card = document.createElement('div');
                        card.className = 'image-card';
                        const container = document.createElement('div');
                        container.className = 'image-container';
                        const img = document.createElement('img');
                        const srcUrl = cfg.buildPublicUrl ? cfg.buildPublicUrl(storage_path) : storage_path;
                        img.src = srcUrl;
                        img.alt = `Monad art by ${twitter}`;
                        img.loading = 'lazy';
                        const overlay = document.createElement('div');
                        overlay.className = 'image-overlay';
                        const title = document.createElement('span');
                        title.className = 'image-title';
                        title.textContent = `Art by ${twitter}`;
                        overlay.appendChild(title);
                        container.appendChild(img);
                        container.appendChild(overlay);
                        card.appendChild(container);
                        galleryGrid.prepend(card);
                        requestAnimationFrame(() => {
                            card.style.animationPlayState = 'running';
                            card.classList.add('animate-in');
                        });
                    });
                    return;
                } else {
                    console.warn('REST approved fetch failed with status', res.status);
                }
            } catch (e) {
                console.warn('REST approved fetch error:', e);
            }
        }
        const approved = getApprovedSubmissions();
        if (!approved || !approved.length) return;
        for (let i = approved.length - 1; i >= 0; i -= 1) {
            const { src, twitter } = approved[i];
            const card = document.createElement('div');
            card.className = 'image-card';
            const container = document.createElement('div');
            container.className = 'image-container';
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Monad art by ${twitter}`;
            img.loading = 'lazy';
            const overlay = document.createElement('div');
            overlay.className = 'image-overlay';
            const title = document.createElement('span');
            title.className = 'image-title';
            title.textContent = `Art by ${twitter}`;
            overlay.appendChild(title);
            container.appendChild(img);
            container.appendChild(overlay);
            card.appendChild(container);
            galleryGrid.prepend(card);
            requestAnimationFrame(() => {
                card.style.animationPlayState = 'running';
                card.classList.add('animate-in');
            });
        }
    }

    function hideLoading() {
        loading.classList.add('hidden');
    }

    function showGallery() {
        gallery.classList.add('visible');
        
        // Trigger staggered animations for cards
        imageCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.animationPlayState = 'running';
            }, index * 100);
        });
    }

    function setupImageLoading() {
        // Handle image loading states
        images.forEach(img => {
            // If image is already loaded
            if (img.complete) {
                handleImageLoad(img);
            } else {
                // Wait for image to load
                img.addEventListener('load', () => handleImageLoad(img));
                img.addEventListener('error', () => handleImageError(img));
            }
        });
    }

    function handleImageLoad(img) {
        img.classList.add('loaded');
        
        // Add a subtle fade-in effect
        setTimeout(() => {
            img.style.opacity = '1';
        }, 100);
    }

    function handleImageError(img) {
        console.warn('Failed to load image:', img.src);
        // You could add a placeholder or error handling here
        img.style.opacity = '0.5';
        img.alt = 'Image failed to load';
    }

    function setupScrollAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        // Observe image cards for scroll animations
        imageCards.forEach(card => {
            observer.observe(card);
        });
    }

    function setupSmoothScroll() {
        // Enhance smooth scrolling for any internal links
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

    // Add hover sound effect (optional, commented out for accessibility)
    function setupHoverEffects() {
        imageCards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                // Optional: Add subtle hover effects
                this.style.transform = 'translateY(-8px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
            });
        });
    }

    // Keyboard navigation support
    function setupKeyboardNavigation() {
        imageCards.forEach((card, index) => {
            card.setAttribute('tabindex', '0');
            
            card.addEventListener('keydown', function(e) {
                switch(e.key) {
                    case 'Enter':
                    case ' ':
                        // Simulate click behavior
                        this.click();
                        e.preventDefault();
                        break;
                    case 'ArrowRight':
                        // Navigate to next card
                        const nextCard = imageCards[index + 1];
                        if (nextCard) {
                            nextCard.focus();
                        }
                        e.preventDefault();
                        break;
                    case 'ArrowLeft':
                        // Navigate to previous card
                        const prevCard = imageCards[index - 1];
                        if (prevCard) {
                            prevCard.focus();
                        }
                        e.preventDefault();
                        break;
                }
            });
        });
    }

    // (Removed throttle utility; no longer needed)

    // Lazy load optimization for future images
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const lazyImageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                            lazyImageObserver.unobserve(img);
                        }
                    }
                });
            });

            // Observe future lazy images
            document.querySelectorAll('img[data-src]').forEach(img => {
                lazyImageObserver.observe(img);
            });
        }
    }

    // Initialize additional features
    setupKeyboardNavigation();
    setupLazyLoading();

    // Removed parallax effect for smoother scrolling

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Recalculate any responsive elements if needed
            console.log('Window resized:', window.innerWidth, 'x', window.innerHeight);
        }, 250);
    });

    // Add loading progress feedback
    function updateLoadingProgress() {
        let loadedImages = 0;
        const totalImages = images.length;
        
        images.forEach(img => {
            img.addEventListener('load', () => {
                loadedImages++;
                const progress = (loadedImages / totalImages) * 100;
                
                // Update loading text with progress
                const loadingText = loading.querySelector('p');
                if (loadingText) {
                    loadingText.textContent = `Loading Monad art... ${Math.round(progress)}%`;
                }
            });
        });
    }

    updateLoadingProgress();

    // Add error handling for the entire application
    window.addEventListener('error', (e) => {
        console.error('Application error:', e.error);
        // Could implement user-friendly error messaging here
    });

    // Accessibility: Reduce motion for users who prefer it
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
        // Disable animations for users who prefer reduced motion
        document.body.classList.add('reduced-motion');
    }

    // Console note
    console.log('Monadgram loaded');
});
