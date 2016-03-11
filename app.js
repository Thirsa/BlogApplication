var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var session = require('express-session')
var Sequelize = require('sequelize');

var sequelize = new Sequelize('blog', process.env.POSTGRES_USER, null, {
	host: 'localhost',
	dialect: 'postgres',
	// define: {
	// 	timestamps: false //I comment this out because I want to have the date and setting it to true didn't work
	// }
});

var Users = sequelize.define('users', {
	name:{
       type: Sequelize.STRING,
       unique: true
    },
	email: {
		type: Sequelize.STRING,
		unique: true
	},     
	password:{
		type: Sequelize.STRING
	} 
});

var Posts = sequelize.define('posts', {
	title: {
		type: Sequelize.STRING
	},
	body: {
		type: Sequelize.TEXT
	}
});

var Comments = sequelize.define('comments', {
	body: {
		type: Sequelize.TEXT
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

app.use(express.static('/public'));
app.use(bodyParser.urlencoded({ extended: true }))

app.set('views', './views');
app.set('view engine', 'jade');

app.get('/', function (request, response){
	var user = request.session.user;

	if (user === undefined){
		response.render('index',{message: request.query.message})
	}
	else {
		response.render('index',{user: user})
	}
});

app.post('/login', function (request, response){
	Users.findOne({
		where: {
			name: request.body.username
		}
	}).then(function (users){
		if(users !== null && request.body.password === users.password){ //it's if they typed their username wrong...
			request.session.user = users;
			response.redirect('/profile');
		}
		else {
			response.redirect('/?message=' + encodeURIComponent("Invalid username or password"))
		}
	}, function (error){
			response.redirect('/?message=' + encodeURIComponent("Invalid username or password"))
	})
});

app.get('/profile', function (request, response) {
	var user = request.session.user; 

	if (user === undefined){
		var message = "please login again :)"
		response.render ('index', {message:message})
	}
	else {
		response.render('user', {user: user, message: request.query.message})
	}
})

app.post('/user/new', function (request, response){
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
			if (error.name === "SequelizeUniqueConstraintError" || error.email === "SequelizeUniqueConstraintError" || error.password === "SequelizeUniqueConstraintError"){
				response.redirect('/?message=' + encodeURIComponent("the constraints on the database have been violated"))						
			} 
			else if (error.name === "SequelizeDatabaseError" || error.email === "SequelizeDatabaseError" || error.password === "SequelizeDatabaseError"){
				response.redirect('/?message=' + encodeURIComponent("Oops, seems like you fucked up"))										
			}
			else { 
				throw error;
			}
		})
	}		
});

app.get('/posts', function (request, response){
	var user = request.session.user

	if (user === undefined){
		var message = "please login again :)"
		response.render ('index', {message:message})
	}
	else {
		Posts.findAll({include: [Users]}).then(function (posts){
			var data = posts.map(function (post){
				return {
					title: post.dataValues.title,
					body: post.dataValues.body,
					name: post.dataValues.user.name,
					id: post.dataValues.id,
					createdAt: post.dataValues.createdAt				
				}
			})
			response.render('post', {data: data.reverse(), user: user})		
		})
	}
})

app.get('/user/:id/posts', function (request, response){
	var user = request.session.user
	if (user === undefined) {
		var message = "Please login again :)"
		response.render ('index', {message:message})
	} 
	else {
		Posts.findAll({include: [Users], where: { userId: user.id}}).then(function (posts){
			var data = posts.map(function (post){
				return {
					title: post.dataValues.title,
					body: post.dataValues.body,
					id: post.dataValues.id,
					createdAt: post.dataValues.createdAt
				}
			})
			response.render('post', {data: data.reverse(), user: user})		
		})
	}
});

app.post('/posts', function (request, response){
	var user = request.session.user

	if (user === undefined){
		var message = "Please login again :)"
		response.render ('index', {message:message})
	}
	else {
		if (request.body.title === "" || request.body.body === "") {
			response.redirect('/profile?message=' + encodeURIComponent("please fill in all the boxes"))
		}
		else {
			Posts.create ({
				userId: user.id,
				title: request.body.title,
				body: request.body.body
			}).then(function (data){response.redirect('/user/:id/posts')
			}, function (error) {
				if (error.name === "SequelizeDatabaseError"){
					var error = "Oops, something went wrong, try again" //think about if this is the apropriate message
					response.render ('user', {user:user, error:error})
				}
				else if (error){
					throw error;
				}
			})		
		}
	}	
});

app.get('/logout', function (request, response){
	request.session.destroy(function(error) {
		if(error) {
			throw error;
		}
		response.redirect('/?message=' + encodeURIComponent("Successfully logged out"));
	})
});

app.get('/posts/:id', function (request, response){
	var postId = request.params.id;
	var user = request.session.user;

	if (user === undefined){
		var message = "Please login again :)"
		response.render ('index', {message:message})
	}
	else {
		Posts.findOne({include: Users, where: {id: postId}}).then(function (post){
			var onePost = {
				title: post.dataValues.title,
				body: post.dataValues.body,
				id: post.dataValues.id,
				username: post.dataValues.user.name,
				createdAt: post.dataValues.createdAt
			}
			Comments.findAll({include: [Users], where: {postId: postId}}).then(function (posts){
				var allcomments = posts.map(function (post){
					return {
						username: post.dataValues.user.name,
						comment: post.dataValues.body,
						createdAt: post.dataValues.createdAt
					}
				})
				response.render('postPlusComments', {onePost: onePost, allcomments:allcomments, user: user, message: request.query.message})
			})
		})
	}
});

app.post('/user/comment/:postId', function (request, response){
	var user = request.session.user
	var requestParameters = request.params;

	if (user === undefined){
		var message = "Please login again :)"
		response.render ('index', {message:message})
	}
	else {
		Comments.create ({
			userId: user.id,
			postId: requestParameters.postId,		
			body: request.body.comment
		}).then(function (data){		
			response.redirect('/posts/' + requestParameters.postId)
		}, function (error) {
			if (error.name === "SequelizeDatabaseError"){
				response.redirect('/posts/' + requestParameters.postId + '/?message=' + encodeURIComponent("Something went wrong, please try to comment again :)")) // render what page? 
			}
			else {
				throw error;
			}
		})
	}	
});

app.post ('/user/:id/password', function (request, response){
	var user = request.session.user
	var userId = request.params
	var newPassword = request.body.newPassword

	if (user === undefined) {
		var message = "Please login again :)"
		response.render ('index', {message:message})
	}
	else {
		if (request.body.oldPassword === "" || request.body.newPassword === ""){
			response.redirect('/profile?message=' + encodeURIComponent("Please fill in the old password and the new password"))
		}
		else if (request.body.oldPassword !== user.password) {
			response.redirect('/profile?message=' + encodeURIComponent("Your password is incorrect"))		
		}
		else if (request.body.oldPassword === user.password) {
			Users.findOne({where: {id: user.id}}).then(function (target){
				target.update({password: newPassword}).then(function (user){
					request.session.user = user;
					var messagePass = "Your password has been updated"
					response.render('user', {user:user,messagePass:messagePass})
				}, function (error) {
					if (error) {
						throw error;
					}
				})
			})
		}
		else{
			response.redirect('/profile?message=' + encodeURIComponent("God knows what, but something went wrong"))		
		}
	}
})

//I have to take the force out (if it's there) when im done with the app
sequelize.sync({force:true}).then(function () {
	var server = app.listen(3000, function () {
		console.log(server.address().port);
	});
});

//TODO:
//i still have to do something with capitilizing the names when register or log in
//(how) do I edit my posts and comments?
//Get the createdAt date in a different format
//I have to trim all the input fields so that solely spaces will not be written to the database

//Notes to self:
//only worry about performance when you have over a million or 10 million of something
//postgres database diagram.. to find a app that will give me a graphical view of my database
//there are two general rules about doing something if something === undefined first or do the thing if something !== undefined.. there's no better one..
//I probably cant use a put request to change the password because forms probably only allow post and get request... so I could use Ajax for that.. but that might be too fancy?
// allowNull: false //Jon said: only probably have this protection also on the database (not only in the app) if theres multiple components(?) using your database etc... having it for a blog app is overkill

