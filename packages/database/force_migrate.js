const { spawn } = require('child_process');
const p = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'phase1_6_correction_pack', '--config', 'prisma.config.ts'], { 
  cwd: __dirname,
  env: process.env,
  shell: true
});


p.stdout.on('data', d => {
  const output = d.toString();
  process.stdout.write(output);
  if (output.includes('We need to reset') || output.includes('Do you want to continue? All existing data will be lost')) {
    p.stdin.write('y\n');
  }
});

p.stderr.on('data', d => {
  process.stderr.write(d.toString());
});

p.on('close', c => {
  console.log('Finished with exit code ' + c);
});
