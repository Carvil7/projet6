const Sauce = require('../models/sauce');
const fs = require('fs');

exports.createSauce = (req, res, next) => {
  const sauceObject = JSON.parse(req.body.sauce);
  delete sauceObject._id;
  delete sauceObject._userId;
  const sauce = new Sauce({
      ...sauceObject,
      userId: req.auth.userId,
      imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`, 
      likes:0, 
      dislikes:0
  });

  sauce.save()
  .then(() => { res.status(201).json({message: 'Objet enregistré !'})})
  .catch(error => { res.status(400).json( { error })})
};

exports.getOneSauce = (req, res, next) => {
  Sauce.findOne({
    _id: req.params.id
  }).then(
    (sauce) => {
      res.status(200).json(sauce);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

exports.modifySauce = (req, res, next) => {
  const sauceObject = req.file ? {
      ...JSON.parse(req.body.sauce),
      imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  } : { ...req.body };

  delete sauceObject._userId;
  Sauce.findOne({_id: req.params.id})
      .then((sauce) => {
          if (sauce.userId != req.auth.userId) {
              res.status(403).json({ message : 'Not authorized'});
          } else {
              Sauce.updateOne({ _id: req.params.id}, { ...sauceObject, _id: req.params.id})
              .then(() => res.status(200).json({message : 'Objet modifié!'}))
              .catch(error => res.status(401).json({ error }));
          }
      })
      .catch((error) => {
          res.status(400).json({ error });
      });
};

exports.deleteSauce = (req, res, next) => {
  Sauce.findOne({ _id: req.params.id})
      .then(sauce => {
          if (sauce.userId != req.auth.userId) {
              res.status(403).json({message: 'Not authorized'});
          } else {
              const filename = sauce.imageUrl.split('/images/')[1];
              fs.unlink(`images/${filename}`, () => {
                  Sauce.deleteOne({_id: req.params.id})
                      .then(() => { res.status(200).json({message: 'Objet supprimé !'})})
                      .catch(error => res.status(401).json({ error }));
              });
          }
      })
      .catch( error => {
          res.status(500).json({ error });
      });
};

exports.getAllSauces = (req, res, next) => {
  Sauce.find().then(
    (sauces) => {
      res.status(200).json(sauces);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};

exports.like = async (req, res, next) => {
  const likeStatus = req.body.like;
  const authUserId = req.auth.userId;
  const filterById = { _id: req.params.id };

  const addLike = {
    $inc: { likes: +1 },
    $push: { usersLiked: authUserId },
  };
  const addDislike = {
    $inc: { dislikes: +1 },
    $push: { usersDisliked: authUserId },
  };
  const removeLike = {
    $inc: { likes: -1 },
    $pull: { usersLiked: authUserId },
  };
  const removeDislike = {
    $inc: { dislikes: -1 },
    $pull: { usersDisliked: authUserId },
  };

  try {
    const sauce = await Sauce.findOne(filterById);
    switch (likeStatus) {
      case 1: {
        if (!sauce.usersLiked.includes(authUserId)) {
          await Sauce.findOneAndUpdate(filterById, addLike, { new: true });
          res.status(201).json({ message: `Vous aimez ${sauce.name} sauce ` });
        } else {
          return;
        }

        break;
      }
      case -1: {
        if (!sauce.usersDisliked.includes(authUserId)) {
          await Sauce.findOneAndUpdate(filterById, addDislike, { new: true });
          res.status(201).json({ message: `Vous n'aimez pas ${sauce.name} sauce` });
        } else {
          return;
        }

        break;
      }
      case 0: {
        if (sauce.usersLiked.includes(authUserId)) {
          await Sauce.findOneAndUpdate(filterById, removeLike, { new: true });
          res
            .status(201)
            .json({ message: `Vous avez supprimé votre like sur ${sauce.name}` });
        } else if (sauce.usersDisliked.includes(authUserId)) {
          await Sauce.findOneAndUpdate(filterById, removeDislike, {
            new: true,
          });
          res.status(201).json({
            message: `Vous avez supprimé votre dislike sur ${sauce.name} sauce`,
          });
        } else {
          return;
        }
        break;
      }
    }
  } catch (error) {
    res.status(400).json(error);
  }
};

