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
       unique: true,
       allowNull: false
    },
	email: {
		type: Sequelize.STRING,
		unique: true,
		allowNull: false
	},     
	password:{
		type: Sequelize.STRING,
		allowNull: false
	} 
});

var Posts = sequelize.define('posts', {
	title: {
		type: Sequelize.STRING,
		allowNull: false
	},
	body: {
		type: Sequelize.TEXT,
		allowNull:false
	}
});

var Comments = sequelize.define('comments', {
	body: {
		type: Sequelize.TEXT,
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

app.use(express.static('/public'));
app.use(bodyParser.urlencoded({ extended: true }))

app.set('views', './views');
app.set('view engine', 'jade');

app.get('/', function (request, response){
	var user = request.session.user;

	if (user === undefined){
		response.render('loginAgain',{message: request.query.message})
	}
	else {
		response.render('index', {user: user})
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
		response.render ('loginAgain', {message:message})
	}
	else {
		console.log ("Request.query.message" + request.query.message)
		response.render('user', {user: user, message: request.query.message}) //request.query.message?? what does it do here??
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
		response.render ('loginAgain', {message:message})
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
			console.log ("heres my data from the /posts route" + typeof data)
			// if ()
			response.render('post', {data: data.reverse(), user: user})		
		})
	}
})

app.get('/user/:id/posts', function (request, response){ //switch the order of the if and else around?
	var user = request.session.user
	if (user === undefined) {
		var message = "logged out from route /user/:id/posts. please login again :)"
		response.render ('loginAgain', {message:message})
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

app.post('/posts', function (request, response){ //Can i use a if user === undefined or something here?
	var user = request.session.user

	if (user === undefined){
		var message = "logged out from /posts. please login again :)"
		response.render ('loginAgain', {message:message})
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
					console.log (error);
					var error = "The post is too long or something" //think about if this is the apropriate message
					response.render ('user', {user:user, error:error})
				}
				else if (error){ //can you end with an else if? instead of just an else?
					throw error;
				}
			})		
		}
	}	
});

app.get('/logout', function (request, response){
	request.session.destroy(function(error) {
		if(error) {
			throw error; //do I want to throw an error or is that klantontvriendelijk?
		}
		response.redirect('/?message=' + encodeURIComponent("Successfully logged out"));
	})
});

app.get('/posts/:id', function (request, response){
	var postId = request.params.id;
	var user = request.session.user;

	if (user === undefined){
		var message = "logged out from route posts/:id. please login again :)"
		response.render ('loginAgain', {message:message})
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
				response.render('postPlusComments', {onePost: onePost, allcomments:allcomments.reverse(), user: user})
			})
		})
	}
});

app.post('/user/comment/:postId', function (request, response){
	var user = request.session.user
	var requestParameters = request.params;

	if (user === undefined){
		var message = "logged out from route posts. please login again :)"
		response.render ('loginAgain', {message:message})
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
				console.log (error)
				// response.render // render what page? 
			}
			else { //change if into else if the above is commented in
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
		var message = "logged out from route /user/:id/password. please login again :)"
		response.render ('loginAgain', {message:message})
	}
	else {

		if (request.body.oldPassword === "" || request.body.newPassword === ""){
			response.redirect('/profile?message=' + encodeURIComponent("Please fill in the old password and the new password"))
		}
		else if (request.body.oldPassword !== user.password) {
			response.redirect('/profile?message=' + encodeURIComponent("You password is incorrect"))		
		}
		else if (request.body.oldPassword === user.password) {
			console.log ("Im here first")
			Users.findOne({where: {id: user.id}}).then(function (target){
				console.log ("Console.logging the user"+ JSON.stringify(target))

				target.update({password: newPassword}).then(function (user){
					console.log ("I'm here!!")
					request.session.user = user;
					var message = "Your password has been updated"
					response.render('user', {user:user,message:message})
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
sequelize.sync().then(function () {
	var server = app.listen(3001, function () {
		console.log(server.address().port);
	});
});

//i still have to do something with capitilizing the names when register or log in
// i still have to set the type value of posts and comments to text
//I still probably have to change the post route to change my password into a put?
//(how) do I edit my posts and comments?
//Get the created date in a different format
//