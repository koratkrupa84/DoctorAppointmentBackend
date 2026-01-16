const express = require("express")
const dbConnect = require("./config/dbConnect")
const app = express()
const port = 5000;
const cors = require("cors");
const Path = require("path");


const userRoute = require("./routes/userRoutes")
const doctorRoute = require("./routes/doctor")
const adminRoute = require("./routes/admin")
const aiAdvisorRoute = require("./routes/aiAdvisor")

app.use(express.json())
app.use(cors());

// Log only API route path for backend calls
app.use((req, res, next) => {
    const url = req.originalUrl || req.url
    if (url.startsWith('/user') || url.startsWith('/doctor') || url.startsWith('/admin')) {
        console.log(url)
    }
    next()
})

// app.use("/", (req, res) => {
//      // dbConnect();
//      res.send("Welcome to the Doctor Appointment API");
// })

app.use("/uploads", express.static(Path.join(__dirname,"uploads")));

app.use('/user', userRoute);
app.use('/doctor', doctorRoute);
app.use('/admin', adminRoute);
app.use('/ai', aiAdvisorRoute);

dbConnect();

app.listen(port);
