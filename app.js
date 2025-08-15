document.addEventListener('DOMContentLoaded', function() {
    'use strict';
    
    // =====================================================
    // 1. DOM ELEMENT CACHING (Performance Improvement #1)
    // =====================================================
    const DOM = {
        // Core elements
        loading: null,
        gallery: null,
        galleryGrid: null,
        
        // Upload modal elements
        shareArtBtn: null,
        uploadModal: null,
        cancelBtn: null,
        uploadForm: null,
        fileInput: null,
        twitterInput: null,
        uploadBtn: null,
        
        // Preview elements
        imagePreview: null,
        imagePreviewImg: null,
        
        // Success elements
        successOverlay: null,
        successClose: null,
        
        // Dynamic elements
        imageCards: null,
        images: null,
        messageEl: null
    };
    
    // =====================================================
    // 2. STATE MANAGEMENT PATTERN (Improvement #8)
    // =====================================================
    const AppState = {
        isUploading: false,
        isInitialized: false,
        touchStartY: 0,
        touchEndY: 0,
        scrollTimeout: null,
        resizeTimeout: null,
        observers: new Set(),
        eventListeners: new Map(),
        
        // State setters with validation
        setUploading(value) {
            if (typeof value !== 'boolean') {
                throw new Error('Upload state must be boolean');
            }
            this.isUploading = value;
        },
        
        cleanup() {
            // Clear timeouts
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
            if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
            
            // Disconnect observers
            this.observers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (e) {
                    console.warn('Error disconnecting observer:', e);
                }
            });
            this.observers.clear();
            
            // Remove event listeners
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
    // 3. UTILITY FUNCTIONS WITH ERROR HANDLING
    // =====================================================
    const Utils = {
        // Debounce function for performance
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
        
        // Safe DOM query with error handling
        safeQuery(selector, parent = document) {
            try {
                return parent.querySelector(selector);
            } catch (e) {
                console.error(`Error querying selector "${selector}":`, e);
                return null;
            }
        },
        
        // Safe DOM query all with error handling
        safeQueryAll(selector, parent = document) {
            try {
                return parent.querySelectorAll(selector);
            } catch (e) {
                console.error(`Error querying selector "${selector}":`, e);
                return [];
            }
        },
        
        // Safe storage operations
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
    // 4. ENHANCED ERROR HANDLING (Improvement #3)
    // =====================================================
    const ErrorHandler = {
        logError(context, error, data = {}) {
            console.error(`[${context}] Error:`, error, data);
            
            // Track error for analytics
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
            
            // Show user-friendly message
            if (DOM.messageEl || context === 'upload') {
                MessageManager.show('Something went wrong. Please try again.', 'error');
            }
            
            return fallback;
        }
    };
    
    // =====================================================
    // 5. ENHANCED MESSAGE MANAGER (Improvement #5)
    // =====================================================
    const MessageManager = {
        show(message, type = 'info', duration = 5000) {
            try {
                if (!DOM.uploadForm) return;
                
                // Create or update message element
                if (!DOM.messageEl) {
                    DOM.messageEl = document.createElement('div');
                    DOM.messageEl.id = 'upload-message';
                    DOM.messageEl.className = 'upload-message';
                    DOM.uploadForm.appendChild(DOM.messageEl);
                }
                
                // Set message content and styling
                DOM.messageEl.textContent = message;
                DOM.messageEl.className = `upload-message ${type}`;
                DOM.messageEl.hidden = false;
                DOM.messageEl.setAttribute('role', 'alert');
                DOM.messageEl.setAttribute('aria-live', 'polite');
                
                // Auto-hide after duration
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
    // 6. LOADING MANAGER WITH STATES (Improvement #5)
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
    // 7. STORAGE MANAGER (Improvement #3)
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
    // 8. UPLOAD MANAGER (Improvement #4 - Function Decomposition)
    // =====================================================
    const UploadManager = {
        validateFile(file) {
            if (!file) {
                throw new Error('No file selected');
            }
            
            // Add file validation logic here if needed
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                throw new Error('File size must be less than 10MB');
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
    // 9. MODAL MANAGER (Improvement #4)
    // =====================================================
    const ModalManager = {
        open() {
            try {
                if (DOM.uploadModal && DOM.shareArtBtn) {
                    DOM.uploadModal.hidden = false;
                    DOM.shareArtBtn.setAttribute('aria-expanded', 'true');
                    DOM.uploadModal.setAttribute('aria-hidden', 'false');
                    
                    // Focus first input for accessibility
                    if (DOM.fileInput) {
                        DOM.fileInput.focus();
                    }
                }
            } catch (error) {
                ErrorHandler.logError('ModalManager.open', error);
            }
        },
        
        close() {
            try {
                if (DOM.uploadModal && DOM.shareArtBtn && DOM.uploadForm) {
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
    // 10. GALLERY MANAGER (Improvement #7)
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
                
                // Observe existing images
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
        
        addImageToGallery(src, twitter) {
            try {
                if (!DOM.galleryGrid) return;
                
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
                
                DOM.galleryGrid.appendChild(imageCard);
                
                // Setup lazy loading for new image
                const newImg = imageCard.querySelector('img');
                if (newImg) {
                    this.setupCustomLazyLoading();
                }
                
            } catch (error) {
                ErrorHandler.logError('GalleryManager.addImageToGallery', error, { src, twitter });
            }
        },
        
        renderApprovedFromStorage() {
            try {
                const approved = StorageManager.getApprovedSubmissions();
                approved.forEach(item => {
                    this.addImageToGallery(item.src, item.twitter);
                });
            } catch (error) {
                ErrorHandler.logError('GalleryManager.renderApprovedFromStorage', error);
            }
        }
    };
    
    // =====================================================
    // 11. EVENT MANAGER (Improvement #6)
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
            // Share button click
            this.addListener(DOM.shareArtBtn, 'click', () => {
                ModalManager.open();
            });
            
            // Cancel button click
            this.addListener(DOM.cancelBtn, 'click', () => {
                ModalManager.close();
            });
            
            // File input change (preview)
            this.addListener(DOM.fileInput, 'change', () => {
                this.handleFilePreview();
            });
            
            // Form submit
            this.addListener(DOM.uploadForm, 'submit', (e) => {
                this.handleFormSubmit(e);
            });
        },
        
        handleFilePreview() {
            try {
                if (DOM.fileInput?.files?.[0] && DOM.imagePreview && DOM.imagePreviewImg) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        DOM.imagePreviewImg.src = reader.result;
                        DOM.imagePreview.hidden = false;
                    };
                    reader.onerror = () => {
                        ErrorHandler.logError('FileReader', new Error('Failed to read file'));
                        MessageManager.show('Failed to preview image', 'error');
                    };
                    reader.readAsDataURL(DOM.fileInput.files[0]);
                } else {
                    if (DOM.imagePreview) DOM.imagePreview.hidden = true;
                    if (DOM.imagePreviewImg) DOM.imagePreviewImg.removeAttribute('src');
                }
            } catch (error) {
                ErrorHandler.logError('EventManager.handleFilePreview', error);
            }
        },
        
        async handleFormSubmit(e) {
            e.preventDefault();
            document.activeElement?.blur();
            
            // Prevent multiple submissions
            if (AppState.isUploading) {
                console.log('Upload already in progress, ignoring submission');
                return;
            }
            
            try {
                AppState.setUploading(true);
                UploadManager.setButtonState(true, 'Uploading...');
                
                // Validate inputs
                const file = DOM.fileInput?.files?.[0];
                const twitterValue = DOM.twitterInput?.value;
                
                UploadManager.validateFile(file);
                const twitterUser = UploadManager.validateTwitterHandle(twitterValue);
                
                // Process upload
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const cfg = window.MonadgramConfig || {};
                        
                        if (cfg.EDGE?.UPLOAD_URL) {
                            try {
                                await UploadManager.uploadToRemote(reader.result, file.name, twitterUser);
                                MessageManager.show('Thank you for sharing your Monad art! It has been submitted for approval.', 'success');
                            } catch (remoteError) {
                                console.error('Remote upload failed, falling back to local:', remoteError);
                                UploadManager.saveToLocal(reader.result, twitterUser);
                                MessageManager.show('Upload failed, but saved locally. Please try again later.', 'warning');
                            }
                        } else {
                            UploadManager.saveToLocal(reader.result, twitterUser);
                            MessageManager.show('Thank you for sharing your Monad art! It has been saved locally.', 'success');
                        }
                        
                        // Close modal and show success
                        ModalManager.close();
                        this.showSuccessOverlay();
                        
                    } catch (uploadError) {
                        ErrorHandler.handleAsyncError('Upload Processing', uploadError);
                    } finally {
                        AppState.setUploading(false);
                        UploadManager.setButtonState(false, 'Upload');
                    }
                };
                
                reader.onerror = () => {
                    const error = new Error('Failed to read file');
                    ErrorHandler.handleAsyncError('FileReader', error);
                    AppState.setUploading(false);
                    UploadManager.setButtonState(false, 'Upload');
                };
                
                reader.readAsDataURL(file);
                
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
            // Debounced scroll handler (Improvement #2)
            const debouncedScroll = Utils.debounce(() => {
                // Handle scroll-based animations or effects
            }, 16);
            
            this.addListener(window, 'scroll', debouncedScroll, { passive: true });
            
            // Debounced resize handler (Improvement #2)
            const debouncedResize = Utils.debounce(() => {
                // Handle responsive adjustments
            }, 250);
            
            this.addListener(window, 'resize', debouncedResize);
            
            // Keyboard navigation
            this.addListener(document, 'keydown', (e) => {
                if (e.key === 'Escape' && DOM.uploadModal && !DOM.uploadModal.hidden) {
                    ModalManager.close();
                }
            });
            
            // Error handling for failed image loads
            this.addListener(document, 'error', (e) => {
                if (e.target.tagName === 'IMG') {
                    console.error('Failed to load image:', e.target.src);
                    e.target.style.display = 'none';
                }
            }, true);
            
            // Visibility change handling
            this.addListener(document, 'visibilitychange', () => {
                if (document.hidden) {
                    // Page is hidden, could pause animations
                } else {
                    // Page is visible again, could resume animations
                }
            });
            
            // Online/offline status
            this.addListener(window, 'online', () => {
                console.log('Application is online');
                window.MonadgramApp?.trackEvent?.('app_online');
            });
            
            this.addListener(window, 'offline', () => {
                console.log('Application is offline');
                window.MonadgramApp?.trackEvent?.('app_offline');
            });
            
            // Touch gesture support
            this.addListener(document, 'touchstart', (e) => {
                AppState.touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });
            
            this.addListener(document, 'touchend', (e) => {
                AppState.touchEndY = e.changedTouches[0].screenY;
                this.handleSwipeGesture();
            }, { passive: true });
            
            // Smooth scroll for anchor links
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
    // 12. ACCESSIBILITY MANAGER (Improvement #9)
    // =====================================================
    const AccessibilityManager = {
        setup() {
            try {
                this.addAriaLabels();
                this.setupFocusIndicators();
                this.setupKeyboardNavigation();
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
        },
        
        setupKeyboardNavigation() {
            // Additional keyboard navigation can be added here
            // For now, basic Escape key handling is in EventManager
        }
    };
    
    // =====================================================
    // 13. ADMIN MANAGER
    // =====================================================
    const AdminManager = {
        isAdmin() {
            // In production, implement proper authentication
            return true;
        },
        
        openAdminPanel() {
            try {
                window.open('/admin', '_blank');
            } catch (error) {
                ErrorHandler.logError('AdminManager.openAdminPanel', error);
            }
        },
        
        setupAdminButton() {
            if (!this.isAdmin()) return;
            
            try {
                const adminBtn = document.createElement('button');
                adminBtn.textContent = 'Admin Panel';
                adminBtn.className = 'btn btn--primary admin-btn';
                adminBtn.setAttribute('aria-label', 'Open Admin Panel');
                
                // Use CSS classes instead of inline styles (Improvement #9)
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
    // 14. PERFORMANCE MANAGER
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
    // 15. MAIN INITIALIZATION FUNCTION
    // =====================================================
    function cacheDOMElements() {
        try {
            // Core elements
            DOM.loading = Utils.safeQuery('#loading');
            DOM.gallery = Utils.safeQuery('#gallery');
            DOM.galleryGrid = Utils.safeQuery('.gallery-grid');
            
            // Upload modal elements
            DOM.shareArtBtn = Utils.safeQuery('#share-art-btn');
            DOM.uploadModal = Utils.safeQuery('#upload-modal');
            DOM.cancelBtn = Utils.safeQuery('#cancel-btn');
            DOM.uploadForm = Utils.safeQuery('#upload-form');
            DOM.fileInput = Utils.safeQuery('#image-upload');
            DOM.uploadBtn = Utils.safeQuery('#upload-form button[type="submit"]');
            
            // Preview elements
            DOM.imagePreview = Utils.safeQuery('#image-preview');
            DOM.imagePreviewImg = Utils.safeQuery('#image-preview-img');
            
            // Success elements
            DOM.successOverlay = Utils.safeQuery('#success-overlay');
            DOM.successClose = Utils.safeQuery('#success-close');
            
            // Dynamic collections
            DOM.imageCards = Utils.safeQueryAll('.image-card');
            DOM.images = Utils.safeQueryAll('img[loading="lazy"]');
            
            // Get form elements safely
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
            // 1. Cache DOM elements first
            cacheDOMElements();
            
            // 2. Show loading state
            LoadingManager.show();
            
            // 3. Setup all managers
            AccessibilityManager.setup();
            EventManager.setupGlobalEvents();
            
            // 4. Setup upload modal if elements exist
            if (DOM.uploadForm && DOM.shareArtBtn) {
                EventManager.setupUploadModalEvents();
            }
            
            // 5. Setup gallery features
            GalleryManager.setupCustomLazyLoading();
            GalleryManager.setupScrollAnimations();
            
            // 6. Setup admin features
            AdminManager.setupAdminButton();
            
            // 7. Setup performance monitoring
            PerformanceManager.setupServiceWorker();
            
            // 8. Simulate loading and show gallery
            setTimeout(() => {
                LoadingManager.hide();
                LoadingManager.showGallery();
                GalleryManager.renderApprovedFromStorage();
                AppState.isInitialized = true;
            }, 1500);
            
            // 9. Track performance
            window.addEventListener('load', () => {
                PerformanceManager.trackPageLoad();
            });
            
        } catch (error) {
            ErrorHandler.logError('init', error);
            
            // Fallback: at least try to show the gallery
            setTimeout(() => {
                LoadingManager.hide();
                LoadingManager.showGallery();
            }, 2000);
        }
    }
    
    // =====================================================
    // 16. CLEANUP AND EXPORT
    // =====================================================
    function cleanup() {
        try {
            AppState.cleanup();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    
    // Cleanup on page unload (Improvement #6)
    window.addEventListener('beforeunload', cleanup);
    
    // Analytics function
    function trackEvent(eventName, properties = {}) {
        try {
            console.log('Event tracked:', eventName, properties);
            // Implement your analytics tracking here
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
        
        // Development helpers
        ...(window.location.hostname === 'localhost' && {
            DOM,
            AppState,
            Utils,
            StorageManager,
            MessageManager
        })
    };
    
    // =====================================================
    // 17. START THE APPLICATION
    // =====================================================
    init();
});


