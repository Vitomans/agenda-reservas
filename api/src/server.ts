import { crearApp } from "./app.ts";
import { config } from "./config.ts";

const app = crearApp();

app.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`);
});
