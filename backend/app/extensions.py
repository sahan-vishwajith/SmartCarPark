from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_sock import Sock

db = SQLAlchemy()
cors = CORS()
sock = Sock()