var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
// var pg = require("pg")
var session = require('express-session')
var Sequelize = require('sequelize');
// var db = "postgres://" + process.env.POSTGRES_USER + ":@localhost/blog";

var sequelize = new Sequelize('blog', 'thirsa', null, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		timestamps: false
	}
});

//I still have to setup all restraints for the allowed table data

var Users = sequelize.define('users', {
	name:{
       type: Sequelize.TEXT,
       //allowNull: false //remeber to put a comma if i comment the next line back in.
       unique: true
    },
	email: {
		type: Sequelize.STRING,
		//allowNull: false,
		//unique: true
	},     
	password:{
		type: Sequelize.STRING,
		//allowNull: false
	} 
});

var Posts = sequelize.define('posts', {
	title: Sequelize.STRING,
	body: Sequelize.STRING,
});

var Comments = sequelize.define('comments', {
	body: Sequelize.STRING,
});

Users.hasMany(Posts);
Posts.belongsTo(Users);

Users.hasMany(Comments);
Comments.belongsTo(Users);

Posts.hasMany(Comments);
Comments.belongsTo(Posts);

var app = express();

app.use(session({
	secret: 'oh wow very secret much security',
	resave: true,
	saveUninitialized: false
}));

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }))

app.set('views', './views');
app.set('view engine', 'jade');

app.get('/', function (request, response){
	response.render('index', {message: request.query.message})
});

app.get('/user/login', function (request, response){


	response.render('user')
});

//do i use ".then" here? and if so, how do i throw an error if i have one? if the constraints are violated for ex.
//i also want to throw specific errors. if the username already exists eg 
app.post('/user/register', function (request, response){
	console.log (request.body.email)
	console.log (request.name)
	if (request.body.username === "" || request.body.email === "" || request.body.password === "") {
		response.redirect('/?message=' + encodeURIComponent("please fill in all the boxes"))				
	}
	else {
		Users.create({
			name: request.body.username,
			email: request.body.email,
			password: request.body.password
		}).then(function (user) {
			response.redirect('/?message=' + encodeURIComponent("You can now login"))		
		}, function (error){
			if (error.name === "SequelizeUniqueConstraintError"){
			response.redirect('/?message=' + encodeURIComponent("the name already exists"))						
			} else {
				throw error;
			}
		})
	}		
});

app.get('/user/posts', function (request, response){
	response.render('post')
});

app.get('/user/:id/posts', function (request, response){
	response.render('post')
});

app.post('/user/blog', function (request, response){
	response.redirect('/user/:id/posts')
});

//it doesnt show my message in the jade file, but it redirects
app.get('/user/logout', function (request, response){
	request.session.destroy(function(error) {
		if(error) {
			throw error;
		}
		console.log ("hi")
		response.redirect('/?message=' + encodeURIComponent("Successfully logged out."));
	})
});

app.get('/user/viewPost', function (request, response){
	response.render('postPlusComments')
});

app.post('/user/comment', function (request, response){
	response.render('postPlusComment')
});

//I still have to take the force out when im done
sequelize.sync().then(function () {
	var server = app.listen(3000, function () {
		console.log(server.address().port);
	});
});

