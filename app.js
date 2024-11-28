
const ejs = require('ejs');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();


app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 600000 } // 10 دقیقه
}));


mongoose.connect('mongodb://localhost/shop_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
});

//Create Usere Detabase
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    type: String // 'admin' or 'user'
});

//Create catgory Detabase
const categorySchema = new mongoose.Schema({
    name: String,
    subcategories: [{
        name: String
    }]
});

//Create ptoducts Detabase
const productSchema = new mongoose.Schema({
    name: String,
    category: String,
    subcategory: String,
    price: Number,
    description: String,
    image: String
});

const User = mongoose.model('User', userSchema);
const Category = mongoose.model('Category', categorySchema);
const Product = mongoose.model('Product', productSchema);

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

//register routes

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({
            username: req.body.username,
            password: hashedPassword,
            email: req.body.email,
            type: 'user'
        });
        await user.save();
        res.redirect('/login');
    } catch (error) {
        res.redirect('/register');
    }
});

//render index
app.get('/', (req, res) => {
    res.render('index', { error: null });
});

//login routes
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (user && await bcrypt.compare(req.body.password, user.password)) {
            req.session.user = {
                id: user._id,
                username: user.username,
                type: user.type
            };
            if (user.type === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/index');
            }
        } else {
            res.render('login', { error: 'نام کاربری یا رمز عبور اشتباه است' });
        }
    } catch (error) {
        res.redirect('/login');
    }
});

//main routes
app.get('/index', async (req, res) => {      
    const products = await Product.find();
    try {
        const loggedIn = !!req.session.user;
        res.render('index', { products, loggedIn, username: req.session.user.username });
    } catch (error) {
        res.render('index', { products, username: "لطفا وارد شوید" });
    
    }
});


app.get('/admin', isAuthenticated, async (req, res) => {
    if (req.session.user.type !== 'admin') {
        return res.redirect('/login');
    }
    try {
        const categories = await Category.find();
        const products = await Product.find();
        res.render('admin', { categories, products });
    } catch (error) {
        res.redirect('/login');
    }
});


app.post('/admin/product', upload.single('image'), async (req, res) => {
    try {
        const product = new Product({
            name: req.body.name,
            category: req.body.category,
            subcategory: req.body.subcategory,
            price: req.body.price,
            description: req.body.description,
            image: req.file ? `/uploads/${req.file.filename}` : ''
        });
        await product.save();
        res.redirect('/admin');
    } catch (error) {
        res.redirect('/admin');
    }
});

app.get('/admin/product/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'خطا در دریافت اطلاعات محصول' });
    }
});

app.post('/admin/product/:id', upload.single('image'), async (req, res) => {
    try {
        const updateData = {
            name: req.body.name,
            category: req.body.category,
            subcategory: req.body.subcategory,
            price: req.body.price,
            description: req.body.description
        };
        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }
        await Product.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin');
    } catch (error) {
        res.redirect('/admin');
    }
});

app.delete('/admin/product/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'خطا در حذف محصول' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});