document.addEventListener('DOMContentLoaded', () => {
    const greetings = [
        "What’s on the agenda today?",
        "How can I help you today?",
        "Ready to dive in?",
        "What can I help with?",
        "Welcome back!",
        "Good to see you!",
        "What you wanna know?",
        "Hello! How's it going?",
        "How can I be of service?",
        "What's on your mind?",
        "Ready to get started?",
        "What are you working on?"
    ];

    const greetingElement = document.querySelector('.greeting');

    if (greetingElement) {
        const randomIndex = Math.floor(Math.random() * greetings.length);
        greetingElement.textContent = greetings[randomIndex];
    }
});