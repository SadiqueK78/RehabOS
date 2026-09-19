export const loadExerciseData = async (exerciseName) => {
    try {
        const module = await import(`../../utils/exercises/${exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)}`);
        const contentModule = await import(`../../assets/content`);
        let imageModule = { default: null };
        try {
            imageModule = await import(`../../assets/instructions/${exerciseName}Help.png`);
        } catch (e) {
            console.warn(`Image for ${exerciseName} not found, falling back to null.`);
        }

        return {
            fsm: module[`${exerciseName}Info`],
            checkFunction: module[`check${exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)}`],
            helpImage: imageModule.default,
            instructionsText: contentModule[`instructionsText${exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)}`],
            instructionsVideo: contentModule[`instructionsVideo${exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)}`],
        };
    } catch (error) {
        console.error(`Error loading exercise data for ${exerciseName}:`, error);
        return null;
    }
};