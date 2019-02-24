//jshint esversion:6

const express = require ("express");
const bodyParser = require ("body-parser");
const request = require ("request");
const mongoose = require ("mongoose");
const _ = require ('lodash');
const ejs = require("ejs");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');
const instagramConnect = require('node-instagram').default;
const axios = require('axios');
require('dotenv').config();


const app = express();

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

app.use(session({
  secret: "A very little secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

///////////////////////////Database Setup//////////////////////////////////


mongoose.connect('mongodb://localhost:27017/fudiDB', {useNewUrlParser: true});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  id: Number,
  igusername: String,
  profile_picture: String,
  full_name: String,
  bio: String,
  access_token: String,
  followers: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);
///////////////////////////Passport Setup//////////////////////////////////

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

///////////////////////////Instagram Connect//////////////////////////////////


const instagram = new instagramConnect({
  clientId: process.env.INSTAGRAM_CLIENT_ID,
  clientSecret: process.env.INSTAGRAM_CLIENT_SECRET
});

const redirectUri = 'http://localhost:3000/auth/instagram/feed';


app.get("/instagram-connect", function(req, res){
  res.render("instagramConnect");
});

app.get('/auth/instagram', (req, res) => {
  res.redirect(instagram.getAuthorizationUrl(redirectUri, { scope: ['basic'] }));
});


app.get('/auth/instagram/feed', async (req, res) => {
  try {
    const userID = req.user._id;
    const data = await instagram.authorizeUser(req.query.code, redirectUri);
    User.findOneAndUpdate({_id: userID}, {access_token: data.access_token}, function(err){
      if(!err){
        res.redirect("/ig-success");
      }
    });
  } catch (err) {
    res.json(err);
     }
  });


// app.get('/auth/instagram/feed/:id', async (req, res) => {
//   try {
//     const data = await instagram.authorizeUser(req.query.code, redirectUri);
//
//
//     const newUserInfo = new User({
//       username: data.user.username,
//       full_name: data.user.full_name,
//       access_token: data.access_token,
//     });
//
//     newUserInfo.save();
//     res.redirect("/");
//   } catch (err) {
//     res.json(err);
//   }
// });

/////////////////////////// Search Bar ////////////////////////////////////////

// app.post("/search", function(req, res){
//   User.find({igusername: req.body.search}, function(err, profileInfo){
//     if(!err){
//       if (!profileInfo.length){
//         res.render("noSearchResults");
//       } else {
//         res.render("home", {profileInfo: profileInfo});
//       }
//     }
//   });
// });


// app.post("/search", function(req, res){
//   User.find( {$or: [{igusername: new RegExp(req.body.search)}, {bio: new RegExp(req.body.search)}]}, function(err, profileInfo){
//     if(!err){
//       if (!profileInfo.length){
//         res.render("noSearchResults");
//       } else {
//         res.render("home", {profileInfo: profileInfo});
//       }
//     }
//   });
// });

// app.post("/filter", function(req,res){
//   const minfollowers = req.body.minfollowersslider;
//   const maxfollowers = req.body.maxfollowersslider;
//   const
//   User.find({followers: {$gt: minfollowers}}, function(err, profileInfo){
//     if(!err){
//       if (!profileInfo.length){
//         res.render("noSearchResults");
//         console.log(profileInfo);
//       } else {
//         res.render("home", {profileInfo: profileInfo});
//         console.log(profileInfo);
//       }
//     }
//   });
// });

/////////////////////////// GET and POST Requests for main feed //////////////////////////////////

// app.get("/", function(req, res){
//   if (req.isAuthenticated()){
//     User.find({access_token: {$exists: true}}, {access_token: 1}, function(err, tokens){
//       if (err) {
//         console.log(err);
//       } else {
//          if (tokens) {
//           tokens.forEach(function(token){
//             var url = "https://api.instagram.com/v1/users/self/?access_token=" + token.access_token;
//             axios.get(url).then(function (response) {
//               User.findOneAndUpdate({access_token: token.access_token}, {
//                 igusername: response.data.data.username,
//                 bio: response.data.data.bio,
//                 followers: response.data.data.counts.followed_by
//               }, function(err){
//                   if (!err){
//                     User.find({bio: {$exists: true}, igusername: {$exists: true}}, function(err, profileInfo){
//                       if(!err){
//                       res.render("home", {profileInfo: profileInfo});
//                       }
//                     });
//                   }
//                 });
//               }).catch(function (error) {
//                 console.log(error);
//                 });
//               });
//             }
//           }
//         });
//   } else {
//     res.redirect("/login");
//   }
// });


app.get("/", function(req, res){
  if (req.isAuthenticated()){
    User.find({access_token: {$exists: true}}, {access_token: 1}, function(err, tokens){
      if (err) {
        console.log(err);
      } else {
         if (tokens) {
          tokens.forEach(function(token){
            var url = "https://api.instagram.com/v1/users/self/?access_token=" + token.access_token;
            axios.get(url).then(function (response) {
              User.findOneAndUpdate({access_token: token.access_token}, {
                igusername: response.data.data.username,
                bio: response.data.data.bio,
                followers: response.data.data.counts.followed_by
              }, function(err){
                  if (!err){
                    User.find({bio: {$exists: true}, igusername: {$exists: true}}, function(err, profileInfo){
                      if(!err){
                      res.render("home", {profileInfo: profileInfo});
                      }
                    });
                  }
                });
              }).catch(function (error) {
                console.log(error);
                });
              });
            }
          }
        });
  } else {
    res.redirect("/login");
  }
});

app.get("/ig-success", function (req, res){
  if (req.isAuthenticated()){
  const access_token = req.user.access_token
  var url = "https://api.instagram.com/v1/users/self/media/recent/?access_token=" + access_token;
  axios.get(url).then(function (response) {
    User.findOneAndUpdate({access_token: access_token}, {
      $set: {profile_picture: response.data.data[0].images.standard_resolution.url}},
      function(err){
        if (!err){
          res.render("instagramConnectSuccess");
        }
      });
    }).catch(function (error) {
      console.log(error);
      });
    } else {
      res.redirect("/login");
    }
});

app.get("/profile/:username", function(req, res){
  User.find({igusername: {$exists: true}}, function(err, profileInfo){
    if(!err){
    res.render("userprofile", {profileInfo: profileInfo});
    }
  });
});

///////////////////////////// GET and POST for Login - Logout - Register pages ///////////////////////////////////


app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.post("/register", function(req, res){
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      res.cookie('data', req.user);
      passport.authenticate("local")(req, res, function(){
        res.redirect("/instagram-connect");
      });
    }
  });
});

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else { passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      });
    }
  });
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/login");
});

app.listen(3000, function(){
  console.log("Now listening on port 3000!");
  });
