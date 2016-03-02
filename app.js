var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var session = require('express-session')
var Sequelize = require('sequelize');

var sequelize = new Sequelize('blog', process.env.POSTGRES_USER, null, {
	host: 'localhost',
	dialect: 'postgres',
	// define: {
	// 	timestamps: false //this is set to false by Jon, I set it to true to experiment
	// }
});

//I still have to setup all restraints for the allowed table data...like email adres etc..maybe i got it

var Users = sequelize.define('users', {
	name:{
       type: Sequelize.TEXT,
       unique: true
    },
	email: {
		type: Sequelize.STRING,
		unique: true
	},     
	password:{
		type: Sequelize.STRING,
	} 
});

var Posts = sequelize.define('posts', {
	title: {
		type: Sequelize.STRING
		// allowNull: false
	},
	body: {
		type: Sequelize.STRING
		// allowNull: false
	}
	// myDate: {
	// 	type: Sequelize.BOOLEAN,
	// 	defaultValue: Sequelize.NOW
	// }
});

var Comments = sequelize.define('comments', {
	body: {
		type: Sequelize.STRING,
		allowNull: false	
	}
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

app.use(express.static('/public'));  //is views somehow break, i took out the __dirname + part
app.use(bodyParser.urlencoded({ extended: true }))

app.set('views', './views');
app.set('view engine', 'jade');

app.get('/', function (request, response){
	response.render('index', {message: request.query.message, user: request.session.user})
});

app.post('/user/login', function (request, response){
	Users.findOne({
		where: {
			name: request.body.username
		}
	}).then(function (users){
		if(users !== null && request.body.password === users.password){ //it's if they typed their username wrong...
			request.session.user = users;
			response.redirect('/user/profile');
		}
		else {
			response.redirect('/?message=' + encodeURIComponent("Invalid username or password"))
		}
	}, function (error){
		response.redirect('/?message=' + encodeURIComponent("Invalid username or password"))
	})
});

app.get('/user/profile', function (request, response) {
	var user = request.session.user;
	if (user === undefined){
		response.redirect ('/?message=' + encodeURIComponent("please login again/ first"))
	} else {
		response.render('user', {user: user, message: request.query.message})
	}
})

app.post('/user/register', function (request, response){
	if (request.body.username === "" || request.body.email === "" || request.body.password === "") { //i stil have to have it here because clever users might insert their own js code and bypass the jquery
		response.redirect('/?message=' + encodeURIComponent("please fill in all the boxes"))				
	}
	else {
		Users.create({
			name: request.body.username,
			email: request.body.email,
			password: request.body.password
		}).then(function (user) {
			response.redirect('/?message=' + encodeURIComponent("You can now login"))

		}, function (error){ //how can i catch the different errors?

			if (error.name === "SequelizeUniqueConstraintError" || error.email === "SequelizeUniqueConstraintError" || error.password === "SequelizeUniqueConstraintError"){
			response.redirect('/?message=' + encodeURIComponent("the constraints on the database have been violated"))						
			} 
			else { //SequelizeUniqueConstraintError are probably only for the unique violation. other violations shoud have different errors. i should still test this
				throw error;
			}
		})
	}		
});

app.get('/user/posts', function (request, response){
	var user = request.session.user

	Posts.findAll({include: [Users]}).then(function (posts){
		var data = posts.map(function (post){
			return {
				title: post.dataValues.title,
				body: post.dataValues.body,
				name: post.dataValues.user.name,
				id: post.dataValues.id
			}
		})
		response.render('post', {data: data.reverse(), user: user})		
	})
})

app.get('/user/ownPosts', function (request, response){
	var user = request.session.user
	if (user !== undefined) {
		Posts.findAll({include: [Users], where: { userId: user.id}}).then(function (posts){
			var data = posts.map(function (post){
				return {
					title: post.dataValues.title,
					body: post.dataValues.body,
					id: post.dataValues.id
				}
			})
			response.render('post', {data: data.reverse(), user: user})		
		})
	} 
	else {
		response.redirect ('/?message=' + encodeURIComponent("please login again/ first"))		
	}
});

app.post('/user/blog', function (request, response){ //do i need a if user === undefined or something here?
	var user = request.session.user

	if (request.body.title === "" || request.body.body === "") {
		response.redirect('/user/profile?message=' + encodeURIComponent("please fill in all the boxes"))
	}
	else {
		Posts.create ({
			userId: user.id,
			title: request.body.title,
			body: request.body.body
		}).then(function (data){response.redirect('/user/ownPosts')
		}, function (error) {
			if (error){
				throw error;
			}
		})		
	}
});

app.get('/user/logout', function (request, response){
	request.session.destroy(function(error) {
		if(error) {
			throw error;
		}
		response.redirect('/?message=' + encodeURIComponent("Successfully logged out"));
	})
});

app.get('/user/viewPost/:id', function (request, response){
	var postId = request.params.id;
	var user = request.session.user;

	Posts.findAll({include: Users, where: {id: postId}}).then(function (posts){ // should'nt this be a findOne to have the server do less?
		var onePost = posts.map(function(post){
			return {
				title: post.dataValues.title,
				body: post.dataValues.body,
				id: post.dataValues.id,
				username: post.dataValues.user.name
			}
		})
		Comments.findAll({include: [Users], where: {postId: postId}}).then(function (posts){
			var allcomments = posts.map(function (post){
				return {
					username: post.dataValues.user.name,
					comment: post.dataValues.body
				}
			})
			response.render('postPlusComments', {onePost: onePost[0], allcomments:allcomments.reverse(), user: user})
		})
	})
});

app.post('/user/comment/:postId', function (request, response){
	var user = request.session.user
	var requestParameters = request.params;

	// if (request.body.comment === "") {
	// 	// alert("please fill add text to the comment")
	// 	var text = "please!!!"
	// 	response.send('post',{text: text}) //this doesnt work yet. i still have to set the restriction to add empty comments
	// }
	// else {
		Comments.create ({
			userId: user.id,
			postId: requestParameters.postId,		
			body: request.body.comment
		}).then(function (data){		
			response.redirect('/user/viewPost/' + requestParameters.postId)
		}, function (error) {
			if (error){
				throw error;
			}
		})
	// }
});

//I still have to take the force out (if it's there) when im done with the app
sequelize.sync().then(function () {
	var server = app.listen(3000, function () {
		console.log(server.address().port);
	});
});

//i still have to do something with capitilizing the names when register or log in
//I still have to catch all the different errors from the database and make seperate messages for that
//when I'm on the post page, and my server restarts, meaning user is note defined, I get an error instead of a show of the login form.. why?
