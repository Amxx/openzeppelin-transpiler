const { internalTask } = require('@nomiclabs/buidler/config');
const { TASK_COMPILE_GET_COMPILER_INPUT } = require('@nomiclabs/buidler/builtin-tasks/task-names');

internalTask(TASK_COMPILE_GET_COMPILER_INPUT, async (args, bre, runSuper) => {
  const input = await runSuper();
  input.settings.outputSelection['*']['*'].push('storageLayout');
  return input;
});

module.exports = {
  solc: {
    version: '0.6.7',
  },
};
