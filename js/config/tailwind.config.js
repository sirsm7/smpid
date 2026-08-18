/**
 * js/config/tailwind.config.js
 * Centralized Tailwind CSS Configuration for NADIM Project
 * This file merges all custom colors and animations previously found
 * across multiple HTML files into a single, reusable configuration object.
 */

window.tailwind = window.tailwind || {};

window.tailwind.config = {
    theme: {
        extend: {
            fontFamily: { 
                sans: ['Inter', 'sans-serif'],
                // Added Lexend font family from SPKA modules
                lexend: ['Lexend', 'sans-serif']
            },
            colors: {
                // Brand Colors (Standard across most files)
                brand: { 
                    50: '#f0fdf4', 
                    100: '#dcfce7', 
                    500: '#22c55e', 
                    600: '#16a34a', 
                    700: '#15803d', 
                    900: '#14532d' 
                },
                // Info Colors (from about.html)
                info: { 
                    50: '#eff6ff', 
                    500: '#3b82f6', 
                    600: '#2563eb', 
                    900: '#1e3a8a' 
                },
                // Indigo Colors (from admin.html and gallery.html)
                indigo: { 
                    50: '#eef2ff', 
                    100: '#e0e7ff', 
                    500: '#6366f1', 
                    600: '#4f46e5', 
                    700: '#4338ca', 
                    900: '#312e81' 
                },
                // PPD Colors (from user.html and public.html)
                ppd: { 
                    50: '#f3e8ff', 
                    100: '#e9d5ff', 
                    500: '#a855f7', 
                    600: '#8b5cf6', // Added from user.html
                    700: '#7e22ce', 
                    900: '#581c87' 
                },
                // Helpdesk Colors (from helpdesk/index.html)
                helpdesk: { 
                    50: '#fef2f2', 
                    100: '#fee2e2', 
                    500: '#ef4444', 
                    600: '#dc2626', 
                    700: '#b91c1c', 
                    900: '#7f1d1d' 
                },
                // Delima Colors (from helpdesk/index.html)
                delima: { 
                    50: '#eff6ff', 
                    100: '#dbeafe', 
                    500: '#3b82f6', 
                    600: '#2563eb', 
                    700: '#1d4ed8' 
                }
            },
            animation: {
                // Animations from about.html and gallery.html
                'fade-up': 'fadeUp 0.6s ease-out forwards',
                'fade-in': 'fadeIn 0.4s ease-out forwards',
                // Animation from helpdesk/index.html
                'slide-down': 'slideDown 0.3s ease-out forwards',
                // Animation from SPKA index.html
                'bounce-slow': 'bounce 3s infinite',
                // Animation from SPKA quiz.html
                'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both'
            },
            keyframes: {
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                fadeIn: {
                    // Merged keyframes: about.html uses opacity only, others use scale
                    // Using the more complex one from booking/index.html and helpdesk/index.html
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                slideDown: { 
                    '0%': { opacity: '0', transform: 'translateY(-10px)' }, 
                    '100%': { opacity: '1', transform: 'translateY(0)' } 
                },
                shake: { 
                    '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' }, 
                    '20%, 80%': { transform: 'translate3d(2px, 0, 0)' }, 
                    '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' }, 
                    '40%, 60%': { transform: 'translate3d(4px, 0, 0)' } 
                }
            }
        }
    }
};