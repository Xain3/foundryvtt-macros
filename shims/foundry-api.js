// This file includes shims or wrappers around the FoundryVTT API for easier interaction.

const FoundryAPI = {
    // Example function to get the active scene
    getActiveScene: function() {
        return canvas.scene;
    },

    // Example function to get the active token
    getActiveToken: function() {
        return canvas.tokens.controlled[0];
    },

    // Example function to send a chat message
    sendChatMessage: function(content) {
        ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker()
        });
    },

    // Example function to roll a die
    rollDice: function(dieString) {
        return new Roll(dieString).roll().total;
    },

    // Add more API wrappers as needed
};

export default FoundryAPI;