'use strict';

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AI server running on port ${PORT}`);
});
