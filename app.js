document.addEventListener('DOMContentLoaded', function() {
    'use strict';
    
    // =====================================================
    // DOM ELEMENT CACHING & STATE MANAGEMENT 
    // =====================================================
    const DOM = {
        loading: null,
        gallery: null,
        galleryGrid: null,
        shareArtBtn: null,
        uploadModal: null,
        cancelBtn: null,
        uploadForm: null,
        fileInput: null,
        twitterInput: null,
        uploadBtn: null,
        imagePreview: null,
        imagePreviewImg: null,
        successOverlay: null,
        successClose: null,
        imageCards: null,
        images: null,
        messageEl: null
    };
    
    const AppState = {
        isUploading: false,
        isInitialized: false,
        touchStartY: 0,
        touchEndY: 0,
        scrollTimeout: null,
        resizeTimeout: null,
        observers: new Set(),
        eventListeners: new Map(),
        
        setUploading(value) {
            if (typeof value !== 'boolean') {
                throw new Error('Upload state must be boolean');
            }
            this.isUploading = value;
        },
        
        cleanup() {
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
            if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
            
            this.observers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (e) {
                    console.warn('Error disconnecting observer:', e);
                }
            });
            this.observers.clear();
            
            this.eventListeners.forEach((listener, element) => {
                try {
                    element.removeEventListener(listener.event, listener.handler);
                } catch (e) {
                    console.warn('Error removing event listener:', e);
                }
            });
            this.eventListeners.clear();
        }
    };
    
    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================
    const Utils = {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        safeQuery(selector, parent = document) {
            try {
                return parent.querySelector(selector);
            } catch (e) {
                console.error(`Error querying selector "${selector}":`, e);
                return null;
            }
        },
        
        safeQueryAll(selector, parent = document) {
            try {
                return parent.querySelectorAll(selector);
            } catch (e) {
                console.error(`Error querying selector "${selector}":`, e);
                return [];
            }
        },
        
        safeGetStorage(key, fallback = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : fallback;
            } catch (e) {
                console.error(`Error reading from localStorage key "${key}":`, e);
                return fallback;
            }
        },
        
        safeSetStorage(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error(`Error writing to localStorage key "${key}":`, e);
                return false;
            }
        }
    };
    
    // =====================================================
    // ERROR HANDLING
    // =====================================================
    const ErrorHandler = {
        logError(context, error, data = {}) {
            console.error(`[${context}] Error:`, error, data);
            
            if (window.MonadgramApp?.trackEvent) {
                window.MonadgramApp.trackEvent('error', {
                    context,
                    error: error.message,
                    stack: error.stack,
                    ...data
                });
            }
        },
        
        handleAsyncError(context, error, fallback = null) {
            this.logError(context, error);
            
            if (DOM.messageEl || context === 'upload') {
                MessageManager.show('Something went wrong. Please try again.', 'error');
            }
            
            return fallback;
        }
    };
    
    // =====================================================
    // MESSAGE MANAGER
    // =====================================================
    const MessageManager = {
        show(message, type = 'info', duration = 5000) {
            try {
                if (!DOM.uploadForm) return;
                
                if (!DOM.messageEl) {
                    DOM.messageEl = document.createElement('div');
                    DOM.messageEl.id = 'upload-message';
                    DOM.messageEl.className = 'upload-message';
                    DOM.uploadForm.appendChild(DOM.messageEl);
                }
                
                DOM.messageEl.textContent = message;
                DOM.messageEl.className = `upload-message ${type}`;
                DOM.messageEl.hidden = false;
                DOM.messageEl.setAttribute('role', 'alert');
                DOM.messageEl.setAttribute('aria-live', 'polite');
                
                setTimeout(() => {
                    if (DOM.messageEl) {
                        DOM.messageEl.hidden = true;
                    }
                }, duration);
                
            } catch (error) {
                ErrorHandler.logError('MessageManager.show', error, { message, type });
            }
        },
        
        hide() {
            try {
                if (DOM.messageEl) {
                    DOM.messageEl.hidden = true;
                }
            } catch (error) {
                ErrorHandler.logError('MessageManager.hide', error);
            }
        }
    };
    
    // =====================================================
    // LOADING MANAGER
    // =====================================================
    const LoadingManager = {
        show() {
            try {
                if (DOM.loading) {
                    DOM.loading.classList.remove('hidden');
                    DOM.loading.setAttribute('aria-hidden', 'false');
                }
                if (DOM.gallery) {
                    DOM.gallery.classList.remove('visible');
                    DOM.gallery.setAttribute('aria-hidden', 'true');
                }
            } catch (error) {
                ErrorHandler.logError('LoadingManager.show', error);
            }
        },
        
        hide() {
            try {
                if (DOM.loading) {
                    DOM.loading.classList.add('hidden');
                    DOM.loading.setAttribute('aria-hidden', 'true');
                }
            } catch (error) {
                ErrorHandler.logError('LoadingManager.hide', error);
            }
        },
        
        showGallery() {
            try {
                if (DOM.gallery) {
                    DOM.gallery.classList.add('visible');
                    DOM.gallery.setAttribute('aria-hidden', 'false');
                }
            } catch (error) {
                ErrorHandler.logError('LoadingManager.showGallery', error);
            }
        }
    };
    
    // =====================================================
    // STORAGE MANAGER
    // =====================================================
    const STORAGE_KEYS = {
        PENDING: 'monadgram_pending',
        APPROVED: 'monadgram_approved'
    };
    
    const StorageManager = {
        getPendingSubmissions() {
            return Utils.safeGetStorage(STORAGE_KEYS.PENDING, []);
        },
        
        setPendingSubmissions(items) {
            if (!Array.isArray(items)) {
                ErrorHandler.logError('StorageManager.setPendingSubmissions', new Error('Items must be an array'));
                return false;
            }
            return Utils.safeSetStorage(STORAGE_KEYS.PENDING, items);
        },
        
        getApprovedSubmissions() {
            return Utils.safeGetStorage(STORAGE_KEYS.APPROVED, []);
        },
        
        setApprovedSubmissions(items) {
            if (!Array.isArray(items)) {
                ErrorHandler.logError('StorageManager.setApprovedSubmissions', new Error('Items must be an array'));
                return false;
            }
            return Utils.safeSetStorage(STORAGE_KEYS.APPROVED, items);
        }
    };
    
    // =====================================================
    // UPLOAD MANAGER
    // =====================================================
    const UploadManager = {
        validateFile(file) {
            if (!file) {
                throw new Error('No file selected');
            }
            
            const maxSize = 1 * 1024 * 1024; // 1MB
            if (file.size > maxSize) {
                throw new Error('File size must be less than 1MB. Please compress your image and try again.');
            }
            
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                throw new Error('File must be an image (JPEG, PNG, GIF, or WebP)');
            }
            
            return true;
        },
        
        validateTwitterHandle(handle) {
            if (!handle || !handle.trim()) {
                throw new Error('Twitter handle is required');
            }
            
            const twitterPattern = /^@?(\w){1,15}$/;
            if (!twitterPattern.test(handle.trim())) {
                throw new Error('Please enter a valid Twitter username');
            }
            
            return handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`;
        },

        // Smart image compression - maintains quality while optimizing size
        async compressImage(file) {
            console.log('compressImage called for:', file.type, 'size:', file.size);
            
            const maxSize = 1024 * 1024;
            
            // Don't compress GIFs - preserve animation
            if (file.type === 'image/gif') {
                console.log('GIF detected, bypassing compression');
                // For GIFs, only check size - don't compress
                if (file.size > maxSize) {
                    // GIF is too large - reject it
                    throw new Error('GIF file size must be under 1MB. Please use a smaller GIF or convert to another format.');
                }
                console.log('Converting GIF to data URL');
                const dataUrl = await this.fileToDataUrl(file);
                return { dataUrl, mimeType: 'image/gif', wasCompressed: false };
            }
            
            // For non-GIF formats, always convert to JPEG using canvas
            console.log('Starting JPEG conversion/compression for file type:', file.type);
              
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                img.onload = () => {
                    const originalSizeKB = Math.round(file.size / 1024);
                    
                    // Smart compression strategy based on original size
                    let targetSizeKB, maxQuality, minQuality;
                    
                    if (originalSizeKB <= 100) {
                        targetSizeKB = Math.max(originalSizeKB * 0.9, 80);
                        maxQuality = 0.98;
                        minQuality = 0.92;
                    } else if (originalSizeKB <= 300) {
                        targetSizeKB = Math.max(originalSizeKB * 0.7, 150);
                        maxQuality = 0.95;
                        minQuality = 0.88;
                    } else if (originalSizeKB <= 600) {
                        targetSizeKB = Math.max(originalSizeKB * 0.5, 250);
                        maxQuality = 0.92;
                        minQuality = 0.82;
                    } else {
                        targetSizeKB = Math.max(originalSizeKB * 0.4, 350);
                        maxQuality = 0.90;
                        minQuality = 0.78;
                    }
                    
                    // Calculate optimal dimensions (max 1920px for quality)
                    let { width, height } = img;
                    const maxDimension = 1920;
                    
                    if (width > maxDimension || height > maxDimension) {
                        const ratio = Math.min(maxDimension / width, maxDimension / height);
                        width *= ratio;
                        height *= ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Try high quality first - if it's already under target, use it
                    const highQualityDataUrl = canvas.toDataURL('image/jpeg', maxQuality);
                    const highQualitySizeKB = Math.round((highQualityDataUrl.length * 0.75) / 1024);
                    
                    if (highQualitySizeKB <= targetSizeKB) {
                        console.log(`Image optimized: ${originalSizeKB}KB → ${highQualitySizeKB}KB (${maxQuality * 100}% quality)`);
                        resolve({ dataUrl: highQualityDataUrl, mimeType: 'image/jpeg', wasCompressed: true });
                        return;
                    }

                    // Binary search for optimal quality to hit target size
                    const findOptimalQuality = (minQ, maxQ, attempts = 0) => {
                        if (attempts > 6) { // Max 6 attempts for performance
                            return canvas.toDataURL('image/jpeg', Math.max(minQ, 0.75)); // Never go below 75%
                        }
                        
                        const midQ = (minQ + maxQ) / 2;
                        const dataUrl = canvas.toDataURL('image/jpeg', midQ);
                        const sizeKB = Math.round((dataUrl.length * 0.75) / 1024);
                        
                        if (Math.abs(sizeKB - targetSizeKB) < 25) { // Within 25KB of target
                            return dataUrl;
                        }
                        
                        if (sizeKB > targetSizeKB) {
                            return findOptimalQuality(minQ, midQ, attempts + 1);
                        } else {
                            return findOptimalQuality(midQ, maxQ, attempts + 1);
                        }
                    };
                    
                    const compressedDataUrl = findOptimalQuality(minQuality, maxQuality);
                    const finalSizeKB = Math.round((compressedDataUrl.length * 0.75) / 1024);
                    const compressionRatio = Math.round((1 - finalSizeKB / originalSizeKB) * 100);
                    
                    console.log(`Image compressed: ${originalSizeKB}KB → ${finalSizeKB}KB (${compressionRatio}% reduction)`);
                    resolve({ dataUrl: compressedDataUrl, mimeType: 'image/jpeg', wasCompressed: true });
                };
                
                img.src = URL.createObjectURL(file);
            });
        },

        async uploadToRemote(dataUrl, fileName, twitterUser) {
            const cfg = window.MonadgramConfig || {};
            const uploadUrl = cfg.EDGE?.UPLOAD_URL;
            
            if (!uploadUrl) {
                throw new Error('Remote upload not configured');
            }
            
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(cfg.SUPABASE_ANON_KEY ? { 
                        'apikey': cfg.SUPABASE_ANON_KEY, 
                        'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}` 
                    } : {}),
                },
                body: JSON.stringify({ 
                    dataUrl, 
                    fileName, 
                    twitter: twitterUser 
                })
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }
            
            return response;
        },
        
        saveToLocal(dataUrl, twitterUser) {
            const submission = {
                id: `sub_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
                src: dataUrl,
                twitter: twitterUser,
                createdAt: Date.now()
            };
            
            const pending = StorageManager.getPendingSubmissions();
            pending.push(submission);
            return StorageManager.setPendingSubmissions(pending);
        },
        
        setButtonState(isLoading, text) {
            try {
                if (DOM.uploadBtn) {
                    DOM.uploadBtn.disabled = isLoading;
                    DOM.uploadBtn.textContent = text;
                    
                    if (isLoading) {
                        DOM.uploadBtn.classList.add('uploading');
                        DOM.uploadBtn.setAttribute('aria-busy', 'true');
                    } else {
                        DOM.uploadBtn.classList.remove('uploading');
                        DOM.uploadBtn.setAttribute('aria-busy', 'false');
                    }
                }
            } catch (error) {
                ErrorHandler.logError('UploadManager.setButtonState', error);
            }
        },
        
        // Helper function to convert file to data URL (preserves GIF animation)
        async fileToDataUrl(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    console.log('File converted to data URL:', {
                        type: file.type,
                        size: file.size,
                        resultLength: result.length,
                        isGif: file.type === 'image/gif'
                    });
                    resolve(result);
                };
                reader.readAsDataURL(file);
            });
        },
        
        resetState() {
            try {
                this.setButtonState(false, 'Upload');
                if (DOM.imagePreview) {
                    DOM.imagePreview.hidden = true;
                }
                if (DOM.imagePreviewImg) {
                    DOM.imagePreviewImg.removeAttribute('src');
                }
                AppState.setUploading(false);
            } catch (error) {
                ErrorHandler.logError('UploadManager.resetState', error);
            }
        }
    };
    
    // =====================================================
    // MODAL MANAGER
    // =====================================================
    const ModalManager = {
        open() {
            try {
                if (DOM.uploadModal && DOM.shareArtBtn) {
                    // Prevent body scrolling when modal is open
                    document.body.style.overflow = 'hidden';
                    
                    DOM.uploadModal.hidden = false;
                    DOM.shareArtBtn.setAttribute('aria-expanded', 'true');
                    DOM.uploadModal.setAttribute('aria-hidden', 'false');
                    
                    // Ensure modal is centered in current viewport
                    DOM.uploadModal.scrollTop = 0;
                    
                    // Focus on first input after a short delay
                    setTimeout(() => {
                        if (DOM.fileInput) {
                            DOM.fileInput.focus();
                        }
                    }, 100);
                }
            } catch (error) {
                ErrorHandler.logError('ModalManager.open', error);
            }
        },
        
        close() {
            try {
                if (DOM.uploadModal && DOM.shareArtBtn && DOM.uploadForm) {
                    // Restore body scrolling
                    document.body.style.overflow = '';
                    
                    DOM.uploadModal.hidden = true;
                    DOM.shareArtBtn.setAttribute('aria-expanded', 'false');
                    DOM.uploadModal.setAttribute('aria-hidden', 'true');
                    DOM.uploadForm.reset();
                    UploadManager.resetState();
                    MessageManager.hide();
                }
            } catch (error) {
                ErrorHandler.logError('ModalManager.close', error);
            }
        }
    };
    
    // =====================================================
    // GALLERY MANAGER - FIXED SUPABASE IMAGE LOADING
    // =====================================================
    const GalleryManager = {
        setupCustomLazyLoading() {
            try {
                const imageObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            const src = img.getAttribute('data-src') || img.src;
                            
                            if (src && src !== img.src) {
                                img.src = src;
                            }
                            
                            img.addEventListener('load', () => {
                                img.classList.add('loaded');
                            }, { once: true });
                            
                            observer.unobserve(img);
                        }
                    });
                }, {
                    rootMargin: '50px 0px',
                    threshold: 0.01
                });
                
                AppState.observers.add(imageObserver);
                
                DOM.images.forEach(img => {
                    imageObserver.observe(img);
                });
                
                return imageObserver;
            } catch (error) {
                ErrorHandler.logError('GalleryManager.setupCustomLazyLoading', error);
                return null;
            }
        },
        
        setupScrollAnimations() {
            try {
                const animationObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('animate');
                        }
                    });
                }, {
                    threshold: 0.1,
                    rootMargin: '0px 0px -50px 0px'
                });
                
                AppState.observers.add(animationObserver);
                
                DOM.imageCards.forEach(card => {
                    animationObserver.observe(card);
                });
                
                return animationObserver;
            } catch (error) {
                ErrorHandler.logError('GalleryManager.setupScrollAnimations', error);
                return null;
            }
        },
        
        // *** FIXED: RESTORE ORIGINAL SUPABASE IMAGE LOADING ***
        async renderApprovedFromStorage() {
            try {
                if (!DOM.galleryGrid) return;
                
                // Clear existing hardcoded images first
                DOM.galleryGrid.innerHTML = '';
                
        const cfg = window.MonadgramConfig || {};
        const listApprovedUrl = cfg.EDGE?.LIST_APPROVED_URL;
                
                // First try Edge Function (same as your original)
        if (listApprovedUrl) {
            try {
                console.log('Fetching approved list from', listApprovedUrl);
                const res = await fetch(listApprovedUrl);
                if (res.ok) {
                    const { items } = await res.json();
                    console.log('Approved items fetched:', Array.isArray(items) ? items.length : 0);
                            
                            // Sort items by created_at DESC (newest first)
                            const sortedItems = items.sort((a, b) => {
                                const dateA = new Date(a.created_at || a.createdAt || 0);
                                const dateB = new Date(b.created_at || b.createdAt || 0);
                                return dateB - dateA; // Newest first
                            });
                            
                            // Store all items for pagination instead of displaying immediately
                            this.paginationState.allItems = sortedItems;
                            console.log(`Total ${sortedItems.length} images available for pagination`);
                            
                            // Load initial batch
                            this.loadInitialImages();
                    return;
                } else {
                    console.warn('list-approved failed with status', res.status);
                }
            } catch (e) {
                        console.warn('Remote approved fetch failed, falling back to REST:', e);
            }
        }
                
                // Fallback to REST API (same as your original)
        if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
            try {
                const restUrl = `${cfg.SUPABASE_URL}/rest/v1/submissions?select=storage_path,twitter,created_at&status=eq.approved&order=created_at.desc`;
                console.log('Fallback fetching REST approved list from', restUrl);
                        const res = await fetch(restUrl, { 
                            headers: { 
                                apikey: cfg.SUPABASE_ANON_KEY, 
                                Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}` 
                            } 
                        });
                if (res.ok) {
                    const items = await res.json();
                            
                            // Sort items by created_at DESC (newest first)
                            const sortedItems = items.sort((a, b) => {
                                const dateA = new Date(a.created_at || a.createdAt || 0);
                                const dateB = new Date(b.created_at || b.createdAt || 0);
                                return dateB - dateA; // Newest first
                            });
                            
                            // Store all items for pagination instead of displaying immediately
                            this.paginationState.allItems = sortedItems;
                            console.log(`Total ${sortedItems.length} images available for pagination`);
                            
                            // Load initial batch
                            this.loadInitialImages();
                    return;
                } else {
                    console.warn('REST approved fetch failed with status', res.status);
                }
            } catch (e) {
                console.warn('REST approved fetch error:', e);
            }
        }
                
                // Final fallback to local storage (same as your original)
                const approved = StorageManager.getApprovedSubmissions();
        if (!approved || !approved.length) return;
                
                // Sort local storage items by createdAt DESC (newest first)
                const sortedApproved = approved.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.created_at || 0);
                    const dateB = new Date(b.createdAt || b.created_at || 0);
                    return dateB - dateA; // Newest first
                });
                
                // Store all items for pagination instead of displaying immediately
                this.paginationState.allItems = sortedApproved;
                console.log(`Total ${sortedApproved.length} images available for pagination (local storage)`);
                
                // Load initial batch
                this.loadInitialImages();
            } catch (error) {
                ErrorHandler.logError('GalleryManager.renderApprovedFromStorage', error);
            }
        },

        // *** NEW: PAGINATED IMAGE LOADING SYSTEM ***
        paginationState: {
            allItems: [],
            currentIndex: 0,
            itemsPerLoad: 8,  // Load 2 rows (4x2) at a time
            initialLoad: 16,   // Show first 4 rows (4x4) initially
            isLoading: false,
            hasMore: true
        },

        // Load initial batch of images
        loadInitialImages() {
            const items = this.paginationState.allItems.slice(0, this.paginationState.initialLoad);
            items.forEach(item => this.createImageCard(item));
            
            // Update state
            this.paginationState.currentIndex = this.paginationState.initialLoad;
            this.paginationState.hasMore = this.paginationState.currentIndex < this.paginationState.allItems.length;
            
            console.log(`Loaded initial ${items.length} images. ${this.paginationState.allItems.length - items.length} remaining.`);
            
            // Setup infinite scroll after initial images are loaded
            setTimeout(() => {
                this.setupInfiniteScroll();
            }, 500);
        },

        // Load more images when scrolling
        loadMoreImages() {
            if (this.paginationState.isLoading || !this.paginationState.hasMore) return;
            
            this.paginationState.isLoading = true;
            
            const startIndex = this.paginationState.currentIndex;
            const endIndex = Math.min(startIndex + this.paginationState.itemsPerLoad, this.paginationState.allItems.length);
            const items = this.paginationState.allItems.slice(startIndex, endIndex);
            
            // Add loading indicator
            this.showLoadingIndicator();
            
            // Simulate slight delay for smooth UX
            setTimeout(() => {
                items.forEach(item => this.createImageCard(item));
                
                // Update state
                this.paginationState.currentIndex = endIndex;
                this.paginationState.hasMore = endIndex < this.paginationState.allItems.length;
                this.paginationState.isLoading = false;
                
                // Hide loading indicator
                this.hideLoadingIndicator();
                
                // Move sentinel to the very end after adding new images
                const sentinel = document.querySelector('.scroll-sentinel');
                if (sentinel) {
                    DOM.galleryGrid.appendChild(sentinel);
                }
                
                console.log(`Loaded ${items.length} more images. ${this.paginationState.allItems.length - endIndex} remaining.`);
            }, 300);
        },

        // Create individual image card
        createImageCard(item) {
            const { storage_path, twitter, src } = item;
            const cfg = window.MonadgramConfig || {};
            
            const card = document.createElement('div');
            card.className = 'image-card';
            
            const container = document.createElement('div');
            container.className = 'image-container';
            
            const img = document.createElement('img');
            const imgSrc = storage_path ? (cfg.buildPublicUrl ? cfg.buildPublicUrl(storage_path) : storage_path) : src;
            img.src = imgSrc;
            img.alt = `Monad art by ${twitter}`;
            img.loading = 'lazy';
            
            // Ensure GIFs are treated as animated images
            if (imgSrc.includes('image/gif') || imgSrc.includes('.gif') || 
                (src && src.includes('image/gif'))) {
                console.log('GIF detected, ensuring proper handling:', imgSrc);
                // Force reload to ensure GIF animation starts
                img.onload = () => {
                    img.style.animationPlayState = 'running';
                };
            }
            
            const overlay = document.createElement('div');
            overlay.className = 'image-overlay';
            
            const title = document.createElement('span');
            title.className = 'image-title';
            title.textContent = `Art by ${twitter}`;
            
            overlay.appendChild(title);
            container.appendChild(img);
            container.appendChild(overlay);
            card.appendChild(container);
            DOM.galleryGrid.appendChild(card);
            
            // Animate in
            requestAnimationFrame(() => {
                card.style.animationPlayState = 'running';
                card.classList.add('animate-in');
            });
        },

        // Setup infinite scroll detection
        setupInfiniteScroll() {
            console.log('Setting up infinite scroll...', {
                hasMore: this.paginationState.hasMore,
                currentIndex: this.paginationState.currentIndex,
                totalItems: this.paginationState.allItems.length
            });
            
            // Remove any existing sentinel first
            const existingSentinel = document.querySelector('.scroll-sentinel');
            if (existingSentinel) {
                existingSentinel.remove();
            }
            
            const scrollObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    console.log('Sentinel intersecting:', entry.isIntersecting, {
                        isLoading: this.paginationState.isLoading,
                        hasMore: this.paginationState.hasMore
                    });
                    if (entry.isIntersecting && !this.paginationState.isLoading && this.paginationState.hasMore) {
                        console.log('Loading more images...');
                        this.loadMoreImages();
                    }
                });
            }, {
                rootMargin: '100px 0px', // Start loading 100px before reaching bottom
                threshold: 0.1
            });
            
            // Create and observe a sentinel element at the very bottom
            const sentinel = document.createElement('div');
            sentinel.className = 'scroll-sentinel';
            sentinel.style.cssText = 'height: 1px; width: 100%; opacity: 0; pointer-events: none;';
            
            // Add sentinel as the very last element in the gallery
            DOM.galleryGrid.appendChild(sentinel);
            
            scrollObserver.observe(sentinel);
            AppState.observers.add(scrollObserver);
            
            console.log('Infinite scroll setup complete, invisible sentinel added');
        },

        // Show loading indicator
        showLoadingIndicator() {
            const loadingEl = document.getElementById('loading-more');
            if (loadingEl) {
                loadingEl.style.display = 'block';
            }
        },

        // Hide loading indicator
        hideLoadingIndicator() {
            const loadingEl = document.querySelector('.loading-more');
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    };
    
    // =====================================================
    // EVENT MANAGER
    // =====================================================
    const EventManager = {
        addListener(element, event, handler, options = {}) {
            if (!element) return;
            
            try {
                element.addEventListener(event, handler, options);
                AppState.eventListeners.set(element, { event, handler, options });
            } catch (error) {
                ErrorHandler.logError('EventManager.addListener', error);
            }
        },
        
        setupUploadModalEvents() {
            this.addListener(DOM.shareArtBtn, 'click', () => {
                ModalManager.open();
            });
            
            this.addListener(DOM.cancelBtn, 'click', () => {
                ModalManager.close();
            });
            
            this.addListener(DOM.fileInput, 'change', () => {
                this.handleFilePreview();
            });
            
            this.addListener(DOM.uploadForm, 'submit', (e) => {
                this.handleFormSubmit(e);
            });
        },
        
        handleFilePreview() {
            try {
                if (DOM.fileInput?.files?.[0] && DOM.imagePreview && DOM.imagePreviewImg) {
                    const file = DOM.fileInput.files[0];
                    
                    // Validate file size immediately
                    try {
                        UploadManager.validateFile(file);
                    } catch (validationError) {
                        // Show error message and reset file input
                        MessageManager.show(validationError.message, 'error');
                        DOM.fileInput.value = '';
                        DOM.imagePreview.hidden = true;
                        DOM.imagePreviewImg.removeAttribute('src');
                        if (DOM.fileInfo) DOM.fileInfo.style.display = 'none';
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = async () => {
                        // Show original preview
                        DOM.imagePreviewImg.src = reader.result;
                        DOM.imagePreview.hidden = false;
                        
                        // Show original file size info
                        const fileSizeKB = Math.round(file.size / 1024);
                        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                        const sizeText = fileSizeKB > 1024 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`;
                        
                        if (DOM.fileInfo) {
                            DOM.fileInfo.textContent = `File: ${file.name} (${sizeText})`;
                            DOM.fileInfo.style.display = 'block';
                            DOM.fileInfo.style.color = '#10b981'; // Always green since it passed validation
                        }
                        
                        console.log(`File selected: ${file.name} (${sizeText})`);
                    };
                    reader.onerror = () => {
                        ErrorHandler.logError('FileReader', new Error('Failed to read file'));
                        MessageManager.show('Failed to preview image', 'error');
                    };
                    reader.readAsDataURL(file);
            } else {
                    if (DOM.imagePreview) DOM.imagePreview.hidden = true;
                    if (DOM.imagePreviewImg) DOM.imagePreviewImg.removeAttribute('src');
                    if (DOM.fileInfo) DOM.fileInfo.style.display = 'none';
                }
            } catch (error) {
                ErrorHandler.logError('EventManager.handleFilePreview', error);
            }
        },
        
        async handleFormSubmit(e) {
            e.preventDefault();
            document.activeElement?.blur();
            
            if (AppState.isUploading) {
                console.log('Upload already in progress, ignoring submission');
                return;
            }
            
            try {
                AppState.setUploading(true);
                UploadManager.setButtonState(true, 'Uploading...');
                
                const file = DOM.fileInput?.files?.[0];
                const twitterValue = DOM.twitterInput?.value;
                
                UploadManager.validateFile(file);
                const twitterUser = UploadManager.validateTwitterHandle(twitterValue);
                
                // Show compression status
                UploadManager.setButtonState(true, 'Processing...');
                
                try {
                    const result = await UploadManager.compressImage(file);
                    let fileName = file.name;
                    
                    if (result.wasCompressed) {
                        const extMatch = fileName.match(/\.\w+$/);
                        if (extMatch) {
                            fileName = fileName.replace(extMatch[0], '.jpg');
                        } else {
                            fileName += '.jpg';
                        }
                        console.log('Compressed image, adjusted fileName to:', fileName);
                    }
                    
                    const uploadData = result.dataUrl;
                    
                    // Update button to show upload status
                    UploadManager.setButtonState(true, 'Uploading...');
                    
                    const cfg = window.MonadgramConfig || {};
                    
                    if (cfg.EDGE?.UPLOAD_URL) {
                        try {
                            console.log('Uploading to remote:', {
                                type: result.mimeType,
                                fileName: fileName,
                                dataLength: uploadData.length,
                                wasCompressed: result.wasCompressed
                            });
                            
                            await UploadManager.uploadToRemote(uploadData, fileName, twitterUser);
                            console.log('Upload successful!');
                            MessageManager.show('Thank you for sharing your Monad art! It has been submitted for approval.', 'success');
                        } catch (remoteError) {
                            console.error('Remote upload failed, falling back to local:', remoteError);
                            UploadManager.saveToLocal(uploadData, twitterUser);
                            MessageManager.show('Upload failed, but saved locally. Please try again later.', 'warning');
                        }
                    } else {
                        UploadManager.saveToLocal(uploadData, twitterUser);
                        MessageManager.show('Thank you for sharing your Monad art! It has been saved locally.', 'success');
                    }
                    
                    ModalManager.close();
                    this.showSuccessOverlay();
                    
                } catch (uploadError) {
                    ErrorHandler.handleAsyncError('Upload Processing', uploadError);
                } finally {
                    AppState.setUploading(false);
                    UploadManager.setButtonState(false, 'Upload');
                }
                
            } catch (error) {
                ErrorHandler.handleAsyncError('Form Submit', error);
                AppState.setUploading(false);
                UploadManager.setButtonState(false, 'Upload');
            }
        },
        
        showSuccessOverlay() {
            try {
                if (!DOM.successOverlay) return;
                
                DOM.successOverlay.hidden = false;
                DOM.successOverlay.setAttribute('aria-hidden', 'false');
                
                const onClose = () => {
                    if (DOM.successOverlay) {
                        DOM.successOverlay.hidden = true;
                        DOM.successOverlay.setAttribute('aria-hidden', 'true');
                    }
                    if (DOM.successClose) {
                        DOM.successClose.removeEventListener('click', onClose);
                    }
                };
                
                this.addListener(DOM.successClose, 'click', onClose);
                setTimeout(onClose, 3200);
                
            } catch (error) {
                ErrorHandler.logError('EventManager.showSuccessOverlay', error);
            }
        },
        
        setupGlobalEvents() {
            const debouncedScroll = Utils.debounce(() => {
                // Handle scroll-based animations or effects
            }, 16);
            
            this.addListener(window, 'scroll', debouncedScroll, { passive: true });
            
            const debouncedResize = Utils.debounce(() => {
                // Handle responsive adjustments
            }, 250);
            
            this.addListener(window, 'resize', debouncedResize);
            
            this.addListener(document, 'keydown', (e) => {
                if (e.key === 'Escape' && DOM.uploadModal && !DOM.uploadModal.hidden) {
                    ModalManager.close();
                }
            });
            
            this.addListener(document, 'error', (e) => {
                if (e.target.tagName === 'IMG') {
                    console.error('Failed to load image:', e.target.src);
                    e.target.style.display = 'none';
                }
            }, true);
            
            this.addListener(document, 'visibilitychange', () => {
                if (document.hidden) {
                    // Page is hidden
                } else {
                    // Page is visible again
                }
            });
            
            this.addListener(window, 'online', () => {
                console.log('Application is online');
                window.MonadgramApp?.trackEvent?.('app_online');
            });
            
            this.addListener(window, 'offline', () => {
                console.log('Application is offline');
                window.MonadgramApp?.trackEvent?.('app_offline');
            });
            
            this.addListener(document, 'touchstart', (e) => {
                AppState.touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });
            
            this.addListener(document, 'touchend', (e) => {
                AppState.touchEndY = e.changedTouches.screenY;
                this.handleSwipeGesture();
            }, { passive: true });
            
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                this.addListener(anchor, 'click', function(e) {
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
        },
        
        handleSwipeGesture() {
            try {
                const swipeThreshold = 50;
                const diff = AppState.touchStartY - AppState.touchEndY;
                
                if (Math.abs(diff) > swipeThreshold) {
                    if (diff > 0) {
                        console.log('Swipe up detected');
                    } else {
                        console.log('Swipe down detected');
                    }
                }
            } catch (error) {
                ErrorHandler.logError('EventManager.handleSwipeGesture', error);
            }
        }
    };
    
    // =====================================================
    // ACCESSIBILITY MANAGER
    // =====================================================
    const AccessibilityManager = {
        setup() {
            try {
                this.addAriaLabels();
                this.setupFocusIndicators();
            } catch (error) {
                ErrorHandler.logError('AccessibilityManager.setup', error);
            }
        },
        
        addAriaLabels() {
            const buttons = Utils.safeQueryAll('button');
            buttons.forEach(button => {
                if (!button.getAttribute('aria-label') && button.textContent) {
                    button.setAttribute('aria-label', button.textContent.trim());
                }
            });
        },
        
        setupFocusIndicators() {
            const focusableElements = Utils.safeQueryAll('button, input, a, [tabindex]');
            focusableElements.forEach(element => {
                element.addEventListener('focus', () => {
                    element.classList.add('focus-visible');
                });
                element.addEventListener('blur', () => {
                    element.classList.remove('focus-visible');
            });
        });
    }
    };
    
    // =====================================================
    // ADMIN MANAGER - FIXED: ONLY SHOW ON LOCALHOST
    // =====================================================
    const AdminManager = {
        // *** FIXED: Only show admin panel on localhost/development ***
        isAdmin() {
            return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        },
        
        openAdminPanel() {
            try {
                window.open('/admin', '_blank');
            } catch (error) {
                ErrorHandler.logError('AdminManager.openAdminPanel', error);
            }
        },
        
        setupAdminButton() {
            // *** FIXED: Admin button will only appear on localhost now ***
            if (!this.isAdmin()) return;
            
            try {
                const adminBtn = document.createElement('button');
                adminBtn.textContent = 'Admin Panel';
                adminBtn.className = 'btn btn--primary admin-btn';
                adminBtn.setAttribute('aria-label', 'Open Admin Panel');
                
                adminBtn.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                `;
                
                EventManager.addListener(adminBtn, 'click', () => {
                    this.openAdminPanel();
                });
                
                document.body.appendChild(adminBtn);
            } catch (error) {
                ErrorHandler.logError('AdminManager.setupAdminButton', error);
            }
        }
    };
    
    // =====================================================
    // PERFORMANCE MANAGER
    // =====================================================
    const PerformanceManager = {
        trackPageLoad() {
            try {
                if ('performance' in window) {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    if (perfData) {
                        window.MonadgramApp?.trackEvent?.('page_load', {
                            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart
                        });
                    }
                }
            } catch (error) {
                ErrorHandler.logError('PerformanceManager.trackPageLoad', error);
            }
        },
        
        setupServiceWorker() {
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
        }
    };
    
    // =====================================================
    // MAIN INITIALIZATION
    // =====================================================
    function cacheDOMElements() {
        try {
            DOM.loading = Utils.safeQuery('#loading');
            DOM.gallery = Utils.safeQuery('#gallery');
            DOM.galleryGrid = Utils.safeQuery('.gallery-grid');
            
            DOM.shareArtBtn = Utils.safeQuery('#share-art-btn');
            DOM.uploadModal = Utils.safeQuery('#upload-modal');
            DOM.cancelBtn = Utils.safeQuery('#cancel-btn');
            DOM.uploadForm = Utils.safeQuery('#upload-form');
            DOM.fileInput = Utils.safeQuery('#image-upload');
            DOM.fileInfo = Utils.safeQuery('#file-info');
            DOM.uploadBtn = Utils.safeQuery('#upload-form button[type="submit"]');
            
            DOM.imagePreview = Utils.safeQuery('#image-preview');
            DOM.imagePreviewImg = Utils.safeQuery('#image-preview-img');
            
            DOM.successOverlay = Utils.safeQuery('#success-overlay');
            DOM.successClose = Utils.safeQuery('#success-close');
            
            DOM.imageCards = Utils.safeQueryAll('.image-card');
            DOM.images = Utils.safeQueryAll('img[loading="lazy"]');
            
            if (DOM.uploadForm) {
                DOM.twitterInput = DOM.uploadForm.elements['twitter'];
                if (!DOM.fileInput) {
                    DOM.fileInput = DOM.uploadForm.elements['image'];
                }
            }
            
        } catch (error) {
            ErrorHandler.logError('cacheDOMElements', error);
        }
    }
    
    async function init() {
        try {
            cacheDOMElements();
            
            LoadingManager.show();
            
            AccessibilityManager.setup();
            EventManager.setupGlobalEvents();
            
            if (DOM.uploadForm && DOM.shareArtBtn) {
                EventManager.setupUploadModalEvents();
            }
            
            GalleryManager.setupCustomLazyLoading();
            GalleryManager.setupScrollAnimations();
            // Note: setupInfiniteScroll is called after images are loaded
            
            // *** FIXED: Admin button only shows on localhost ***
            AdminManager.setupAdminButton();
            
            PerformanceManager.setupServiceWorker();
            
            setTimeout(() => {
                LoadingManager.hide();
                LoadingManager.showGallery();
                // *** FIXED: This will now properly load from Supabase ***
                GalleryManager.renderApprovedFromStorage();
                AppState.isInitialized = true;
            }, 1500);
            
            window.addEventListener('load', () => {
                PerformanceManager.trackPageLoad();
            });
            
        } catch (error) {
            ErrorHandler.logError('init', error);
            
            setTimeout(() => {
                LoadingManager.hide();
                LoadingManager.showGallery();
            }, 2000);
        }
    }
    
    // =====================================================
    // CLEANUP AND EXPORT
    // =====================================================
    function cleanup() {
        try {
            AppState.cleanup();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    
    window.addEventListener('beforeunload', cleanup);
    
    function trackEvent(eventName, properties = {}) {
        try {
            console.log('Event tracked:', eventName, properties);
        } catch (error) {
            console.error('Error tracking event:', error);
        }
    }
    
    // Export public API
    window.MonadgramApp = {
        openAdminPanel: AdminManager.openAdminPanel.bind(AdminManager),
        isAdmin: AdminManager.isAdmin.bind(AdminManager),
        trackEvent,
        cleanup,
        
        // Development helpers (only on localhost)
        ...(window.location.hostname === 'localhost' && {
            DOM,
            AppState,
            Utils,
            StorageManager,
            MessageManager
        })
    };
    
    // =====================================================
    // START APPLICATION
    // =====================================================
    init();
});
