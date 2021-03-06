# encoding: UTF-8

require 'roda'
require 'concode'
require 'seconds'
require 'concurrent'
require 'message_bus'
require 'dotenv/load'
require 'securerandom'

GAMES = Concurrent::Map.new

Concurrent::TimerTask.new do 
  GAMES.each do |code,info|
    GAMES.delete code if info.fetch(:active, Time.now) < 2.weeks.ago
  end
end.execute

DICE_BAG = [:red]*3 + [:yellow]*4 + [:green]*6

MessageBus.configure(backend: :memory)

class UndeadDice < Roda
  plugin :halt
  plugin :json
  plugin :public
  plugin :message_bus
  plugin :status_handler
  plugin :typecast_params
  plugin :slash_path_empty
  plugin :render, engine: 'slim'
  plugin :sessions, secret: ENV['SESSION_SECRET']

  unless ENV['RACK_ENV'] == 'development'
    plugin :content_security_policy do |csp|
      csp.default_src :none
      csp.style_src :self
      csp.script_src :self
      csp.font_src :self
      csp.img_src :self
      csp.connect_src :self
      csp.form_action :self
      csp.base_uri :none
      csp.frame_ancestors :none
      csp.block_all_mixed_content
      csp.upgrade_insecure_requests
    end
  end
  
  use Rack::CommonLogger

  status_handler(404) do
    view :card, locals: {
      title: '¯\_(ツ)_/¯', 
      text: "Hm. Nothing here. That's weird. Oh well!"
    }
  end

  def self.new_game
    { 
      board: {}, 
      queue: [],
      active: Time.now,
      lock: Concurrent::Semaphore.new(1)
    }
  end

  if ENV['RACK_ENV'] == 'development'
    GAMES['test'] = self.new_game 
  end

  route do |r|
    r.public

    r.root do 
      view :home
    end

    r.on 'new' do 
      r.get do
        if session['admin'] 
          code = Concode::Generator.new.generate SecureRandom.hex
          GAMES[code] = UndeadDice.new_game()
          r.redirect code
        else
          view :new
        end
      end

      r.post do 
        if r.POST['password'] == ENV['PASSWORD']
          session['admin'] = true 
        end

        r.redirect
      end
    end

    r.on GAMES.keys do |code|
      r.message_bus
      game = GAMES[code]
      game[:active] = Time.now

      # this is very probably unecessary, but since two users could
      # modify the game state simultaneously, it seems prudent
      game[:lock].acquire

      r.is do
        r.get do
          render :game
        end
        
        r.post do
          case action = typecast_params.nonempty_str!('action')

          when 'reset'
            game[:queue].clear
            game[:board].clear

          when 'pull'
            if game[:queue].size == 3
              r.halt 400, "Can't pull more than 3 dice"
            end

            color = DICE_BAG.sample
            game[:queue] << color
          
          when 'roll'
            newDice = game[:queue].map do |color|
              id = SecureRandom.hex

              game[:board][id] = { 
                id: id,
                color: color, 
                face: rand((0..5))
              }
            end

            game[:queue].clear
          
          when 'reroll'
            id = typecast_params.nonempty_str! 'id'

            unless game[:board][id]
              r.halt 400, "no die with id #{id} in play" 
            end

            color = game[:board][id][:color]
            game[:queue] << color
            game[:board].delete(id)

          else
            r.halt 400, "unreconized action '#{action}'"
          end

          MessageBus.publish("/#{code}", { 
            board: game[:board],
            queue: game[:queue]            
          })

          'done'
        end
            
      ensure 
        game[:lock].release
      end
    end
  end
end

run UndeadDice.freeze.app
