export default {
  '*.{ts,tsx,js,jsx}': (filenames) => {
    const chunkSize = 25;
    const commands = [];
    for (let i = 0; i < filenames.length; i += chunkSize) {
      const chunk = filenames.slice(i, i + chunkSize).map(f => `"${f}"`).join(' ');
      commands.push(`prettier --write ${chunk}`);
      commands.push(`eslint --fix --no-warn-ignored ${chunk}`);
    }
    return commands;
  },
  '*.{json,md,yml,yaml}': (filenames) => {
    const chunkSize = 25;
    const commands = [];
    for (let i = 0; i < filenames.length; i += chunkSize) {
      const chunk = filenames.slice(i, i + chunkSize).map(f => `"${f}"`).join(' ');
      commands.push(`prettier --write ${chunk}`);
    }
    return commands;
  },
};
